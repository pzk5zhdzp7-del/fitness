// Geführter Trainings-Player: Schritt für Schritt durch Aufwärmen, Sätze,
// Pausen und Cool-down – mit automatischen Countdowns und Sprachansage.
import { state, save } from '../store.js';
import { WARMUP, SESSIONS, getPath } from '../data/skills.js';
import { getMobility } from '../data/mobility.js';
import { PHASES, finishWorkout, setLevel } from '../training.js';
import { pathMuscles } from '../data/muscles.js';
import { soreNote } from '../soreness.js';
import {
  ui, esc, unitOf, fmtClock, fmtRange, videoLink, openSheet, closeSheet, beep, speak, rerender,
} from '../ui.js';

const LEAD = 5; // Sekunden "Bereit machen" vor Zeit-Übungen
const HOLD_LEAD = 3;

function step(w, i = w.pos) {
  return w.steps[i];
}

// Name, Untertitel und Symbol eines Schritts
export function describe(w, st) {
  if (st.t === 'set') {
    const e = w.entries[st.e];
    const path = getPath(e.pathId);
    const level = path.levels[e.level];
    return { icon: path.icon, name: level.name, sub: `Satz ${st.s + 1}/${e.sets} · Ziel ${e.targets[st.s]} ${unitOf(e)}${level.side ? ' je Seite' : ''}` };
  }
  if (st.t === 'warm') {
    const x = WARMUP[st.i];
    return { icon: '🔥', name: x.name, sub: (x.sec ? `${x.sec} s` : `${x.reps}×`) + (st.sets > 1 ? ` · ${st.s + 1}/${st.sets}` : '') };
  }
  if (st.t === 'mob') {
    const m = getMobility(st.id);
    return { icon: '🧘', name: m.name, sub: `${m.sec ? `${m.sec} s` : `${m.reps}×`}${st.side ? ` · ${st.side}` : ''} · ${st.s + 1}/${m.sets}` };
  }
  return { icon: '⏸', name: 'Pause', sub: `${st.sec} s` };
}

function nextWorkStep(w, from = w.pos + 1) {
  for (let i = from; i < w.steps.length; i++) if (w.steps[i].t !== 'rest') return w.steps[i];
  return null;
}

function announce(w) {
  const st = step(w);
  if (!st) return;
  if (st.t === 'rest') {
    const next = nextWorkStep(w);
    speak(`Pause. ${next ? `Als Nächstes: ${describe(w, next).name}` : ''}`);
  } else if (st.t === 'set') {
    const e = w.entries[st.e];
    const level = getPath(e.pathId).levels[e.level];
    speak(`${level.name}. Satz ${st.s + 1} von ${e.sets}. Ziel: ${e.targets[st.s]} ${e.type === 'hold' ? 'Sekunden' : 'Wiederholungen'}`);
  } else {
    const x = st.t === 'warm' ? WARMUP[st.i] : getMobility(st.id);
    const side = st.side ? `, ${st.side === 'links' ? 'linke' : 'rechte'} Seite` : '';
    speak(`${x.name}${side}. ${st.sec ? `${st.sec} Sekunden` : `${st.reps} Wiederholungen`}`);
  }
}

function enterStep(w) {
  w.stepStart = Date.now();
  w.extra = 0;
  ui.pending = null;
  ui.holdStart = null;
  ui.holdBeeped = false;
  ui.lastBeep = null;
  save();
  announce(w);
}

function advance(w) {
  w.pos++;
  if (w.pos >= w.steps.length) {
    finish();
    return;
  }
  enterStep(w);
  rerender();
  window.scrollTo(0, 0);
}

function elapsed(w) {
  return (Date.now() - w.stepStart) / 1000;
}

/* ---------- Ansicht ---------- */

export function viewPlayer() {
  const w = state.activeWorkout;
  if (!w) {
    location.hash = '#/';
    return '';
  }
  const st = step(w);
  const work = w.steps.filter((s) => s.t !== 'rest');
  const doneCount = w.steps.slice(0, w.pos).filter((s) => s.t !== 'rest').length;
  const phase = PHASES[w.phase];
  const title = w.kind === 'mobility' ? 'Beweglichkeit' : SESSIONS[w.session].name;

  const head = `
    <div class="flex between small muted">
      <span>${esc(title)}${w.kind === 'strength' ? ` · <span class="pill" style="background:${phase.color}22;color:${phase.color}">${phase.name}</span>` : ''}</span>
      <span data-timer="elapsed">${fmtClock((Date.now() - w.started) / 1000)}</span>
    </div>
    <div class="progress"><div style="width:${(doneCount / work.length) * 100}%"></div></div>
    <div class="flex between" style="margin:14px 0 8px"><b>${esc(st.sect)}${st.t === 'set' && st.ss ? ` · Runde ${st.round}/${st.rounds}` : ''}</b>
      <button class="btn ghost small" data-action="p-overview">Übersicht ☰</button></div>`;

  let body;
  if (st.t === 'rest') body = restCard(w, st);
  else if (st.t === 'set') body = setCard(w, st);
  else body = guidedCard(w, st);

  return `${head}${body}
    <div class="flex" style="margin-top:14px">
      <button class="btn secondary small" data-action="p-prev" ${w.pos === 0 ? 'disabled' : ''}>← Zurück</button>
      <span class="grow"></span>
      <button class="btn secondary small" data-action="p-finish">Training beenden</button>
    </div>`;
}

function restCard(w, st) {
  const left = st.sec + (w.extra || 0) - elapsed(w);
  const next = nextWorkStep(w);
  const d = next ? describe(w, next) : null;
  return `
    <div class="card rest-card">
      <div class="muted small">Pause</div>
      <div class="timer" data-timer="rest">${fmtClock(left)}</div>
      ${d ? `<div class="small">Als Nächstes: <b>${d.icon} ${esc(d.name)}</b><br><span class="muted">${esc(d.sub)}</span></div>` : ''}
      <div class="flex" style="justify-content:center;margin-top:12px">
        <button class="btn white small" data-action="p-rest-add">+30 s</button>
        <button class="btn white small" data-action="p-skip">Weiter ›</button>
      </div>
    </div>`;
}

function setCard(w, st) {
  const e = w.entries[st.e];
  const path = getPath(e.pathId);
  const level = path.levels[e.level];
  const target = e.targets[st.s];
  const unit = unitOf(e);
  const { muscles, muscles2 } = pathMuscles(e.pathId);
  const sets = Array.from({ length: e.sets }, (_, i) => {
    const v = e.logged[i];
    const cls = v != null ? (v >= e.targets[i] ? 'done' : 'short') : i === st.s ? 'next' : '';
    return `<div class="set ${cls}"><small>Ziel ${e.targets[i]}</small>${v != null ? v : '–'}</div>`;
  }).join('');

  let input;
  if (ui.holdStart) {
    input = `
      <div class="center">
        <div class="muted small" data-timer="hold-label">${Date.now() < ui.holdStart ? 'Bereit machen …' : 'Halten!'}</div>
        <div class="timer" data-timer="hold">0:00</div>
        <div class="progress"><div data-timer="hold-bar" style="width:0%"></div></div>
        <button class="btn block good" data-action="p-hold-stop" style="margin-top:12px">Stopp</button>
      </div>`;
  } else {
    if (ui.pending === null) ui.pending = e.logged[st.s] ?? target;
    input = `
      <div class="stepper">
        <button data-action="p-step" data-d="-1" aria-label="weniger">−</button>
        <div class="value">${ui.pending}<span class="unit">${e.type === 'hold' ? 'Sekunden' : 'Wiederholungen'}</span></div>
        <button data-action="p-step" data-d="1" aria-label="mehr">+</button>
      </div>
      ${e.type === 'hold' ? '<button class="btn secondary block" data-action="p-hold-start" style="margin-bottom:8px">▶︎ Stoppuhr starten</button>' : ''}
      <button class="btn block" data-action="p-done">Satz speichern ✓</button>`;
  }

  return `
    <div class="card">
      <div class="ex-head"><span class="icon">${path.icon}</span>
        <div class="grow"><div class="small muted">${esc(path.name)} · Stufe ${e.level + 1}${e.substituted ? ' (Ersatz)' : ''}</div><h3>${esc(level.name)}</h3></div></div>
      <div class="target-big">
        <div class="small muted">Satz ${st.s + 1} von ${e.sets} · Ziel</div>
        <div class="big">${target} <span class="unit">${unit}${level.side ? ' je Seite' : ''}</span></div>
        <div class="small muted">Bereich ${fmtRange(level)}${e.last ? ` · letztes Mal ${e.last.join(' · ')}` : ''}</div>
      </div>
      ${st.s === 0 ? soreNote(muscles, muscles2) : ''}
      <div class="sets">${sets}</div>
      ${input}
      <details><summary>Ausführung</summary><p class="small">${esc(level.cues)}</p>${videoLink(level.name)}</details>
    </div>`;
}

function guidedCard(w, st) {
  const x = st.t === 'warm' ? WARMUP[st.i] : getMobility(st.id);
  const d = describe(w, st);
  let control;
  if (st.sec) {
    const el = elapsed(w);
    const lead = el < LEAD;
    control = `
      <div class="muted small center" data-timer="guided-label">${lead ? 'Bereit machen …' : 'Los!'}</div>
      <div class="timer" data-timer="guided">${fmtClock(lead ? LEAD - el : st.sec - (el - LEAD))}</div>
      <div class="flex" style="justify-content:center">
        <button class="btn secondary small" data-action="p-restart">↺ Neu starten</button>
        <button class="btn small" data-action="p-skip">Weiter ›</button>
      </div>`;
  } else {
    control = `<div class="big center" style="margin:10px 0">${st.reps}×</div>
      <button class="btn block" data-action="p-skip">Fertig ✓</button>`;
  }
  return `
    <div class="card">
      <div class="ex-head"><span class="icon">${d.icon}</span>
        <div class="grow"><div class="small muted">${st.t === 'mob' ? esc(x.focus) : 'Aufwärmen'}</div><h3>${esc(x.name)}${st.side ? ` <span class="pill">${st.side}</span>` : ''}</h3>
        <div class="small muted">${esc(d.sub)}</div></div></div>
      <p class="small">${esc(x.cues)}</p>
      ${control}
    </div>`;
}

function overview(w) {
  let html = '';
  let sect = null;
  w.steps.forEach((st, i) => {
    if (st.t === 'rest') return;
    if (st.sect !== sect) {
      if (sect !== null) html += '</div>';
      sect = st.sect;
      html += `<h2>${esc(sect)}</h2><div class="list">`;
    }
    const d = describe(w, st);
    let status = i < w.pos ? '✓' : i === w.pos ? '▶︎' : '';
    if (st.t === 'set') {
      const v = w.entries[st.e].logged[st.s];
      status = v != null ? `${v} ${unitOf(w.entries[st.e])}` : status;
    }
    html += `<button class="row ${i === w.pos ? 'current' : ''}" data-action="p-jump" data-idx="${i}">
      <span class="icon">${d.icon}</span><div class="grow"><div>${esc(d.name)}</div><div class="small muted">${esc(d.sub)}</div></div>
      <span class="small muted">${status}</span></button>`;
  });
  html += '</div>';
  openSheet(`<h3>Übersicht</h3><p class="small muted">Tippe auf einen Schritt, um dorthin zu springen.</p>${html}
    <button class="btn block" data-action="close-sheet" style="margin-top:8px">Schließen</button>`);
}

/* ---------- Abschluss ---------- */

function finish() {
  const result = finishWorkout();
  ui.pending = null;
  ui.holdStart = null;
  location.hash = '#/';
  if (result?.saved) setTimeout(() => showSummary(result), 60);
}

function showSummary(r) {
  const mins = Math.max(1, Math.round(r.duration / 60));
  const recs = r.records.map((x) => {
    const p = getPath(x.pathId);
    return `<div class="row"><span class="icon">🏆</span><div class="grow"><b>${esc(p.levels[x.level].name)}</b>
      <div class="small muted">Neue Bestleistung: ${x.best} ${unitOf(x)} (vorher ${x.prevBest})</div></div></div>`;
  }).join('');
  const sugg = r.suggestions.map((s) => {
    const p = getPath(s.pathId);
    const to = p.levels[s.to];
    const text = s.dir > 0
      ? `Ziel in allen Sätzen geschafft! Nächste Stufe: <b>${esc(to.name)}</b>`
      : `Das Ziel war zweimal nicht erreichbar. Einen Schritt zurück: <b>${esc(to.name)}</b>?`;
    return `<div class="card" data-suggestion>
      <div class="flex"><span style="font-size:26px">${p.icon}</span><div class="grow"><b>${esc(p.name)}</b><div class="small">${text}</div></div></div>
      <div class="flex" style="margin-top:10px">
        <button class="btn small ${s.dir > 0 ? 'good' : ''}" data-action="accept-level" data-path="${s.pathId}" data-to="${s.to}">${s.dir > 0 ? 'Aufsteigen' : 'Zurückstufen'}</button>
        <button class="btn small secondary" data-action="dismiss">Auf Stufe bleiben</button>
      </div></div>`;
  }).join('');
  const stats = r.kind === 'mobility' ? `${mins} Min · ${r.mobility} Dehnübungen` : `${mins} Min · ${r.sets} Sätze`;
  openSheet(`
    <div class="center"><div style="font-size:48px">${r.kind === 'mobility' ? '🧘' : '💪'}</div><h3>Training gespeichert</h3>
    <p class="muted">${stats}</p></div>
    ${recs ? `<div class="list">${recs}</div>` : ''}
    ${sugg}
    <button class="btn block" data-action="close-sheet" style="margin-top:8px">Fertig</button>`);
}

/* ---------- Timer ---------- */

export function tick() {
  const w = state.activeWorkout;
  if (!w || !document.body.classList.contains('workout') || document.visibilityState !== 'visible') return;
  const st = step(w);
  if (!st) return;
  const set = (sel, txt) => {
    const el = document.querySelector(`[data-timer="${sel}"]`);
    if (el) el.textContent = txt;
  };
  set('elapsed', fmtClock((Date.now() - w.started) / 1000));
  const el = elapsed(w);

  const countdownBeeps = (left) => {
    const s = Math.ceil(left);
    if (s <= 3 && s >= 1 && ui.lastBeep !== s) {
      ui.lastBeep = s;
      beep(1, 660);
    }
  };

  if (st.t === 'rest') {
    const left = st.sec + (w.extra || 0) - el;
    if (left <= 0) {
      beep(1, 1100);
      advance(w);
    } else {
      set('rest', fmtClock(left));
      countdownBeeps(left);
    }
  } else if ((st.t === 'warm' || st.t === 'mob') && st.sec) {
    if (el < LEAD) {
      set('guided', fmtClock(LEAD - el));
      set('guided-label', 'Bereit machen …');
      countdownBeeps(LEAD - el);
    } else {
      const left = st.sec - (el - LEAD);
      if (left <= 0) {
        beep(2, 1100);
        advance(w);
        return;
      }
      if (ui.lastBeep !== 'go') { ui.lastBeep = 'go'; beep(1, 1100); }
      set('guided', fmtClock(left));
      set('guided-label', 'Los!');
    }
  } else if (st.t === 'set' && ui.holdStart) {
    const e = w.entries[st.e];
    const now = Date.now();
    if (now < ui.holdStart) {
      const left = (ui.holdStart - now) / 1000;
      set('hold', fmtClock(left));
      countdownBeeps(left);
      return;
    }
    if (ui.lastBeep !== 'go') { ui.lastBeep = 'go'; beep(1, 1100); set('hold-label', 'Halten!'); }
    const sec = (now - ui.holdStart) / 1000;
    const target = e.targets[st.s];
    set('hold', fmtClock(Math.floor(sec)));
    const bar = document.querySelector('[data-timer="hold-bar"]');
    if (bar) bar.style.width = `${Math.min(100, (sec / target) * 100)}%`;
    if (!ui.holdBeeped && sec >= target) {
      ui.holdBeeped = true;
      beep(2, 1100);
      speak('Ziel erreicht');
    }
  }
}

/* ---------- Aktionen ---------- */

export const playerActions = {
  'p-step'(el) {
    ui.pending = Math.max(0, (ui.pending ?? 0) + Number(el.dataset.d));
    rerender();
  },
  'p-done'() {
    const w = state.activeWorkout;
    const st = step(w);
    w.entries[st.e].logged[st.s] = ui.pending ?? 0;
    advance(w);
  },
  'p-skip'() {
    advance(state.activeWorkout);
  },
  'p-prev'() {
    const w = state.activeWorkout;
    let i = w.pos - 1;
    while (i > 0 && w.steps[i].t === 'rest') i--;
    w.pos = Math.max(0, i);
    enterStep(w);
    rerender();
  },
  'p-jump'(el) {
    const w = state.activeWorkout;
    w.pos = Number(el.dataset.idx);
    enterStep(w);
    closeSheet();
    rerender();
  },
  'p-restart'() {
    enterStep(state.activeWorkout);
    rerender();
  },
  'p-rest-add'() {
    const w = state.activeWorkout;
    w.extra = (w.extra || 0) + 30;
    save();
    rerender();
  },
  'p-hold-start'() {
    ui.holdStart = Date.now() + HOLD_LEAD * 1000;
    ui.holdBeeped = false;
    ui.lastBeep = null;
    rerender();
  },
  'p-hold-stop'() {
    ui.pending = Math.max(0, Math.floor((Date.now() - ui.holdStart) / 1000));
    ui.holdStart = null;
    rerender();
  },
  'p-overview'() {
    overview(state.activeWorkout);
  },
  'p-finish'() {
    const w = state.activeWorkout;
    const any = w.entries.some((e) => e.logged.some((v) => v != null)) || w.pos > 0;
    if (!confirm(any ? 'Training jetzt beenden? Erledigte Sätze werden gespeichert.' : 'Training abbrechen?')) return;
    finish();
  },
  'accept-level'(el) {
    setLevel(el.dataset.path, Number(el.dataset.to));
    el.closest('[data-suggestion]').innerHTML = '<div class="center"><b>Stufe geändert ✅</b></div>';
    rerender();
  },
  dismiss(el) {
    el.closest('[data-suggestion]').remove();
  },
};

export function beginWorkout() {
  enterStep(state.activeWorkout);
}
