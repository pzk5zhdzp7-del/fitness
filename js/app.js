import { state, save, exportData, importData, resetAll } from './store.js';
import { PATHS, SESSIONS, WARMUP, getPath } from './data/skills.js';
import { getRecipe } from './data/food.js';
import {
  nextSessionKey, currentLevel, startWorkout, finishWorkout, changeLevel,
  workoutsThisWeek, pathHistory,
} from './training.js';
import {
  targets, recipeMacros, dayMeals, dayMacros, ensurePlan, generatePlan, swapMeal,
  shoppingList, scaledItems, GOALS, ACTIVITY,
} from './nutrition.js';

const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $sheet = document.getElementById('sheet');

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// UI-Zustand, der nicht gespeichert werden muss
const ui = {
  foodDay: todayIdx(),
  shopFromToday: false,
  pending: null, // Wert im Stepper
  holdStart: null,
  holdBeeps: 0,
  wakeLock: null,
};

/* ---------- Hilfsfunktionen ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayIdx() {
  return (new Date().getDay() + 6) % 7; // Montag = 0
}

function fmtTarget(level) {
  const unit = level.type === 'hold' ? 's' : 'Wdh.';
  return `${level.sets} × ${level.min}–${level.max} ${unit}${level.side ? ' je Seite' : ''}`;
}

function unitOf(entryOrLevel) {
  return entryOrLevel.type === 'hold' ? 's' : 'Wdh.';
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function n0(v) {
  return Math.round(v).toLocaleString('de-DE');
}

function videoLink(name) {
  const q = encodeURIComponent(`${name} calisthenics tutorial`);
  return `<a class="btn ghost small" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶︎ Video-Anleitung</a>`;
}

function estimateMinutes(key) {
  const paths = SESSIONS[key].paths.filter((id) => state.activePaths.includes(id));
  let sec = 6 * 60;
  for (const id of paths) {
    const { level, path } = currentLevel(id);
    sec += level.sets * (path.rest + 40);
  }
  return Math.round(sec / 60 / 5) * 5;
}

let audioCtx = null;
function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* kein Audio */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(times = 1, freq = 880) {
  if (!audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t = audioCtx.currentTime + i * 0.25;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

async function keepAwake(on) {
  try {
    if (on && !ui.wakeLock && 'wakeLock' in navigator) {
      ui.wakeLock = await navigator.wakeLock.request('screen');
      ui.wakeLock.addEventListener('release', () => { ui.wakeLock = null; });
    } else if (!on && ui.wakeLock) {
      await ui.wakeLock.release();
      ui.wakeLock = null;
    }
  } catch { /* nicht unterstützt */ }
}

function isStandalone() {
  return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
}

/* ---------- Sheet (Overlay von unten) ---------- */

function openSheet(html) {
  $sheet.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`;
  $sheet.classList.remove('hidden');
}

function closeSheet() {
  $sheet.classList.add('hidden');
  $sheet.innerHTML = '';
}

$sheet.addEventListener('click', (e) => {
  if (e.target === $sheet) closeSheet();
});

/* ---------- Views ---------- */

function viewHome() {
  const w = state.activeWorkout;
  const key = nextSessionKey();
  const isTrainingDay = state.trainingDays.includes(new Date().getDay());
  const done = workoutsThisWeek();
  const goal = state.trainingDays.length;
  const trainedToday = state.history.some((h) => new Date(h.date).toDateString() === new Date().toDateString());

  let hero;
  if (w) {
    const total = w.entries.reduce((a, e) => a + e.sets, 0);
    const logged = w.entries.reduce((a, e) => a + Math.min(e.logged.length, e.sets), 0);
    hero = `
      <div class="card hero">
        <div class="muted small">Training läuft</div>
        <h3>${SESSIONS[w.session].name}</h3>
        <div class="muted small">${logged} von ${total} Sätzen erledigt</div>
        <div style="margin-top:12px"><a class="btn white block" href="#/workout">Training fortsetzen</a></div>
      </div>`;
  } else {
    const paths = SESSIONS[key].paths.filter((id) => state.activePaths.includes(id));
    const label = trainedToday ? 'Heute schon trainiert ✅' : isTrainingDay ? 'Heute ist Trainingstag' : 'Ruhetag – Erholung ist Teil des Trainings';
    hero = `
      <div class="card hero">
        <div class="muted small">${label}</div>
        <h3>${SESSIONS[key].name} · ca. ${estimateMinutes(key)} Min</h3>
        <div class="muted small">${paths.map((id) => esc(currentLevel(id).level.name)).join(' · ')}</div>
        <div style="margin-top:12px"><button class="btn white block" data-action="start-workout">Training starten</button></div>
      </div>`;
  }

  const plan = ensurePlan();
  const day = plan.days[todayIdx()];
  const t = targets();
  const m = dayMacros(day);
  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    return `<button class="row" data-action="recipe" data-day="${todayIdx()}" data-id="${r.id}">
      <div class="grow"><div class="small muted">${meal.label}</div><div>${esc(r.name)}</div></div>
      <div class="small muted">${n0(mm.kcal)} kcal</div><span class="chev">›</span></button>`;
  }).join('');

  const recent = state.history.slice(-3).reverse().map((h) => `
    <div class="row"><div class="grow"><div>${SESSIONS[h.session].name}</div>
    <div class="small muted">${fmtDate(h.date)} · ${Math.round(h.duration / 60)} Min · ${h.entries.reduce((a, e) => a + e.sets.length, 0)} Sätze</div></div></div>`).join('');

  const install = isStandalone() ? '' : `
    <div class="card small">📲 <b>Tipp:</b> In Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b> tippen. Dann startet die App wie eine normale App im Vollbild, und deine Daten bleiben dauerhaft gespeichert.</div>`;

  return `
    ${hero}
    <div class="card">
      <div class="flex between"><b>Diese Woche</b><span class="pill ${done >= goal ? 'good' : ''}">${done} / ${goal} Trainings</span></div>
      <div class="progress"><div style="width:${Math.min(100, (done / Math.max(1, goal)) * 100)}%"></div></div>
    </div>
    <h2>Essen heute</h2>
    <div class="card">
      <div class="flex between"><span>${n0(m.kcal)} / ${n0(t.kcal)} kcal</span><span class="muted">${n0(m.p)} / ${t.protein} g Eiweiß</span></div>
      <div class="progress"><div style="width:${Math.min(100, (m.kcal / t.kcal) * 100)}%"></div></div>
    </div>
    <div class="list">${meals}</div>
    ${recent ? `<h2>Letzte Trainings</h2><div class="list">${recent}</div>` : ''}
    ${install}`;
}

function viewSkills() {
  const groups = {};
  for (const p of PATHS) (groups[p.group] ||= []).push(p);
  return Object.entries(groups).map(([group, paths]) => `
    <h2>${group}</h2>
    <div class="list">${paths.map((p) => {
      const { idx, level } = currentLevel(p.id);
      const active = state.activePaths.includes(p.id);
      return `<a class="row" href="#/skill/${p.id}">
        <span class="icon">${p.icon}</span>
        <div class="grow">
          <div class="flex"><b>${esc(p.name)}</b>${active ? '' : '<span class="pill warn">pausiert</span>'}</div>
          <div class="small muted">Stufe ${idx + 1}/${p.levels.length}: ${esc(level.name)}</div>
          <div class="progress"><div style="width:${((idx + 1) / p.levels.length) * 100}%"></div></div>
        </div><span class="chev">›</span></a>`;
    }).join('')}</div>`).join('') + `
    <p class="small muted center">Schaffst du in allen Sätzen das obere Ziel, schlägt dir die App nach dem Training die nächste Stufe vor.</p>`;
}

function chartSvg(points) {
  if (points.length < 2) return '';
  const w = 300, h = 80, pad = 6;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (points.length - 1),
    h - pad - ((v - min) / span) * (h - 2 * pad),
  ]);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${xy.map((p) => p.join(',')).join(' ')}"/>
    ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</svg>`;
}

function viewSkill(id) {
  const path = getPath(id);
  if (!path) return '<div class="empty">Nicht gefunden</div>';
  const { idx, level } = currentLevel(id);
  const active = state.activePaths.includes(id);
  const hist = pathHistory(id);
  const atLevel = hist.filter((h) => h.level === idx).slice(-12);

  const ladder = path.levels.map((l, i) => `
    <li class="${i < idx ? 'done' : i === idx ? 'current' : ''}">
      <span class="dot">${i < idx ? '✓' : i + 1}</span>
      <div class="grow"><div><b>${esc(l.name)}</b></div><div class="small muted">${fmtTarget(l)}</div>
      ${i === idx ? `<details open><summary>Ausführung</summary><p class="small">${esc(l.cues)}</p>${videoLink(l.name)}</details>` : `<details><summary>Ausführung</summary><p class="small">${esc(l.cues)}</p>${videoLink(l.name)}</details>`}
      </div></li>`).join('');

  const recent = hist.slice(-6).reverse().map((h) => `
    <div class="row"><div class="grow"><div class="small">${esc(path.levels[h.level].name)}</div>
    <div class="small muted">${fmtDate(h.date)}</div></div>
    <div class="small">${h.sets.join(' · ')} ${unitOf(h)}</div></div>`).join('');

  return `
    <div class="card">
      <div class="flex"><span style="font-size:36px">${path.icon}</span>
      <div class="grow"><h3>${esc(path.name)}</h3><div class="small muted">Aktuell: Stufe ${idx + 1} – ${esc(level.name)}</div></div></div>
      <div class="flex" style="margin-top:12px">
        <button class="btn secondary small" data-action="level" data-path="${id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>← Stufe zurück</button>
        <button class="btn secondary small" data-action="level" data-path="${id}" data-dir="1" ${idx === path.levels.length - 1 ? 'disabled' : ''}>Stufe vor →</button>
      </div>
      <label class="flex" style="margin-top:12px"><input type="checkbox" data-action="toggle-path" data-path="${id}" ${active ? 'checked' : ''}> Im Trainingsplan</label>
    </div>
    ${atLevel.length >= 2 ? `<h2>Bester Satz auf dieser Stufe</h2><div class="card">${chartSvg(atLevel.map((h) => h.best))}</div>` : ''}
    <h2>Stufen</h2>
    <ul class="ladder list">${ladder}</ul>
    ${recent ? `<h2>Verlauf</h2><div class="list">${recent}</div>` : ''}`;
}

/* ---------- Workout ---------- */

function defaultValue(entry) {
  const i = entry.logged.length;
  if (entry.last) return entry.last[i] ?? entry.last[entry.last.length - 1];
  return entry.min;
}

function viewWorkout() {
  const w = state.activeWorkout;
  if (!w) {
    location.hash = '#/';
    return '';
  }

  if (!w.warmupDone) {
    return `
      <div class="card"><h3>Aufwärmen · ca. 6 Min</h3><p class="small muted">Gerade Handgelenke und Schultern brauchen beim Calisthenics eine gute Vorbereitung.</p></div>
      <div class="list">${WARMUP.map((x) => `
        <label class="check-row"><input type="checkbox"><div class="grow"><div class="name"><b>${esc(x.name)}</b> <span class="muted">· ${x.dose}</span></div>
        <div class="small muted">${esc(x.cues)}</div></div></label>`).join('')}</div>
      <button class="btn block" data-action="warmup-done">Aufwärmen fertig – los geht's</button>
      <div class="center" style="margin-top:8px"><button class="btn ghost" data-action="finish-workout">Training abbrechen</button></div>`;
  }

  const nav = w.entries.map((e, i) => {
    const complete = e.logged.length >= e.sets;
    return `<button class="${i === w.current ? 'on' : complete ? 'complete' : ''}" data-action="goto-ex" data-idx="${i}">${getPath(e.pathId).icon} ${complete ? '✓' : `${e.logged.length}/${e.sets}`}</button>`;
  }).join('');

  const allDone = w.entries.every((e) => e.logged.length >= e.sets);
  const entry = w.entries[w.current];
  const path = getPath(entry.pathId);
  const level = path.levels[entry.level];
  const complete = entry.logged.length >= entry.sets;
  const unit = unitOf(entry);

  const sets = Array.from({ length: Math.max(entry.sets, entry.logged.length) }, (_, i) => {
    const v = entry.logged[i];
    const cls = v !== undefined ? 'done' : i === entry.logged.length ? 'next' : '';
    return `<div class="set ${cls}"><small>Satz ${i + 1}</small>${v !== undefined ? `${v} ${unit}` : '–'}</div>`;
  }).join('');

  let action;
  const resting = w.restUntil && w.restUntil > Date.now();
  if (resting) {
    action = `
      <div class="card rest-card">
        <div class="muted small">Pause</div>
        <div class="timer" data-timer="rest">${fmtClock((w.restUntil - Date.now()) / 1000)}</div>
        <div class="flex" style="justify-content:center">
          <button class="btn white small" data-action="rest-add">+30 s</button>
          <button class="btn white small" data-action="rest-skip">Pause überspringen</button>
        </div>
      </div>`;
  } else if (complete) {
    action = `<div class="card center"><b>Alle Sätze erledigt ✅</b><p class="small muted">${allDone ? 'Super, das war die letzte Übung!' : 'Wähle oben die nächste Übung.'}</p></div>`;
  } else if (ui.holdStart) {
    action = `
      <div class="card center">
        <div class="muted small">Halten · Ziel ${entry.min}–${entry.max} s</div>
        <div class="timer" data-timer="hold">0:00</div>
        <button class="btn block good" data-action="hold-stop">Stopp</button>
      </div>`;
  } else {
    if (ui.pending === null) ui.pending = defaultValue(entry);
    action = `
      <div class="card">
        <div class="center small muted">Satz ${entry.logged.length + 1} von ${entry.sets} · Ziel ${entry.min}–${entry.max} ${unit}${level.side ? ' je Seite' : ''}</div>
        <div class="stepper">
          <button data-action="step" data-d="-1">−</button>
          <div class="value">${ui.pending}<span class="unit">${entry.type === 'hold' ? 'Sekunden' : 'Wiederholungen'}</span></div>
          <button data-action="step" data-d="1">+</button>
        </div>
        ${entry.type === 'hold' ? '<button class="btn secondary block" data-action="hold-start" style="margin-bottom:8px">▶︎ Stoppuhr starten</button>' : ''}
        <button class="btn block" data-action="save-set">Satz speichern</button>
      </div>`;
  }

  const lastTxt = entry.last ? `Letztes Mal: ${entry.last.join(' · ')} ${unit}` : 'Erstes Mal auf dieser Stufe';

  return `
    <div class="exnav">${nav}</div>
    <div class="card">
      <div class="ex-head"><span class="icon">${path.icon}</span>
        <div class="grow"><div class="small muted">${esc(path.name)} · Stufe ${entry.level + 1}</div><h3>${esc(level.name)}</h3></div></div>
      <div class="small muted" style="margin-top:6px">Ziel: ${fmtTarget(level)} · ${lastTxt}</div>
      <div class="sets">${sets}</div>
      ${entry.logged.length ? '<button class="btn ghost small" data-action="undo-set">↶ Letzten Satz löschen</button>' : ''}
      <details><summary>Ausführung</summary><p class="small">${esc(level.cues)}</p>${videoLink(level.name)}</details>
    </div>
    ${action}
    <div style="margin-top:16px">
      <button class="btn ${allDone ? 'good' : 'secondary'} block" data-action="finish-workout">${allDone ? 'Training abschließen 🎉' : 'Training beenden'}</button>
    </div>`;
}

function saveSet(value) {
  const w = state.activeWorkout;
  const entry = w.entries[w.current];
  entry.logged.push(Math.max(0, value));
  ui.pending = null;
  ui.holdStart = null;
  if (entry.logged.length >= entry.sets) {
    // Zur nächsten unvollständigen Übung springen
    const n = w.entries.length;
    let next = -1;
    for (let k = 1; k <= n; k++) {
      const i = (w.current + k) % n;
      if (w.entries[i].logged.length < w.entries[i].sets) { next = i; break; }
    }
    if (next >= 0) {
      w.current = next;
      w.restUntil = Date.now() + entry.rest * 1000;
    } else {
      w.restUntil = null;
    }
  } else {
    w.restUntil = Date.now() + entry.rest * 1000;
  }
  save();
}

function showSummary(suggestions, workout) {
  const sets = workout.entries.reduce((a, e) => a + e.logged.length, 0);
  const mins = Math.round((Date.now() - workout.started) / 60000);
  const items = suggestions.map((s) => {
    const p = getPath(s.pathId);
    const to = p.levels[s.from + s.dir];
    const text = s.dir > 0
      ? `Du hast das Ziel geschafft! Nächste Stufe: <b>${esc(to.name)}</b>`
      : `Das Ziel war zweimal nicht erreichbar. Einen Schritt zurück: <b>${esc(to.name)}</b>?`;
    return `<div class="card" data-suggestion>
      <div class="flex"><span style="font-size:26px">${p.icon}</span><div class="grow"><b>${esc(p.name)}</b><div class="small">${text}</div></div></div>
      <div class="flex" style="margin-top:10px">
        <button class="btn small ${s.dir > 0 ? 'good' : ''}" data-action="accept-level" data-path="${s.pathId}" data-dir="${s.dir}">${s.dir > 0 ? 'Aufsteigen' : 'Zurückstufen'}</button>
        <button class="btn small secondary" data-action="dismiss">Auf Stufe bleiben</button>
      </div></div>`;
  }).join('');
  openSheet(`
    <div class="center"><div style="font-size:48px">💪</div><h3>Training gespeichert</h3>
    <p class="muted">${mins} Min · ${sets} Sätze</p></div>
    ${items}
    <button class="btn block" data-action="close-sheet" style="margin-top:8px">Fertig</button>`);
}

/* ---------- Ernährung ---------- */

function viewFood() {
  const plan = ensurePlan();
  const t = targets();
  const d = ui.foodDay;
  const day = plan.days[d];
  const m = dayMacros(day);

  const tabs = WEEK_ORDER.map((wd, i) => `<button class="${i === d ? 'on' : ''} ${i === todayIdx() ? 'today' : ''}" data-action="food-day" data-idx="${i}">${WEEKDAYS[wd]}</button>`).join('');

  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    return `<div class="row">
      <button class="row" style="padding:0;border:0" data-action="recipe" data-day="${d}" data-id="${r.id}">
        <div class="grow"><div class="small muted">${meal.label} · ${r.time} Min</div><div>${esc(r.name)}</div>
        <div class="small muted">${n0(mm.kcal)} kcal · ${n0(mm.p)} g Eiweiß</div></div></button>
      <button class="btn ghost" data-action="swap" data-day="${d}" data-slot="${meal.slot}" data-index="${meal.index ?? 0}" aria-label="Gericht tauschen">🔄</button>
    </div>`;
  }).join('');

  return `
    <div class="daytabs">${tabs}</div>
    <div class="card">
      <div class="flex between"><b>${n0(m.kcal)} kcal</b><span class="muted small">Ziel ${n0(t.kcal)} kcal · ${t.protein} g Eiweiß</span></div>
      <div class="macros">
        <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
        <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
        <div><b>${n0(m.f)} g</b><span>Fett</span></div>
        <div><b>×${day.scale.toLocaleString('de-DE')}</b><span>Portion</span></div>
      </div>
    </div>
    <div class="list">${meals}</div>
    <p class="small muted">Die Portionsgrößen werden automatisch an dein Kalorienziel angepasst. Mit 🔄 tauschst du ein Gericht aus.</p>
    <button class="btn secondary block" data-action="new-plan">Neuen Wochenplan erstellen</button>`;
}

function showRecipe(dayIdx, id) {
  const plan = ensurePlan();
  const scale = plan.days[dayIdx]?.scale ?? 1;
  const r = getRecipe(id);
  const m = recipeMacros(r, scale);
  openSheet(`
    <h3>${esc(r.name)}</h3>
    <div class="small muted">${r.time} Min${r.veg ? ' · vegetarisch' : ''} · 1 Portion (×${scale.toLocaleString('de-DE')})</div>
    <div class="card macros" style="margin-top:12px">
      <div><b>${n0(m.kcal)}</b><span>kcal</span></div>
      <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
      <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
      <div><b>${n0(m.f)} g</b><span>Fett</span></div>
    </div>
    <h2>Zutaten</h2>
    <div class="list">${scaledItems(r, scale).map((i) => `<div class="row"><div class="grow">${esc(i.name)}</div><div class="muted small">${i.amount}</div></div>`).join('')}</div>
    <p class="small muted">Salz, Pfeffer und Gewürze nach Geschmack.</p>
    <h2>Zubereitung</h2>
    <div class="card"><ol style="margin:0;padding-left:20px">${r.steps.map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join('')}</ol></div>
    <button class="btn block" data-action="close-sheet">Schließen</button>`);
}

/* ---------- Einkauf ---------- */

function viewShopping() {
  const plan = ensurePlan();
  if (state.shopping.weekStart !== plan.weekStart) {
    state.shopping.weekStart = plan.weekStart;
    state.shopping.checked = {};
    save();
  }
  const groups = shoppingList(ui.shopFromToday ? todayIdx() : 0);
  const checked = state.shopping.checked;
  const custom = state.shopping.custom;

  const list = groups.map((g) => `
    <h2>${g.cat}</h2>
    <div class="list">${g.items.map((i) => `
      <label class="check-row ${checked[i.id] ? 'checked' : ''}">
        <input type="checkbox" data-action="check" data-id="${i.id}" ${checked[i.id] ? 'checked' : ''}>
        <span class="grow name">${esc(i.name)}</span><span class="amount">${i.amount}</span></label>`).join('')}</div>`).join('');

  const customList = custom.map((c, i) => `
    <div class="check-row ${c.done ? 'checked' : ''}">
      <input type="checkbox" data-action="check-custom" data-idx="${i}" ${c.done ? 'checked' : ''}>
      <span class="grow name">${esc(c.name)}</span>
      <button class="btn ghost small" data-action="del-custom" data-idx="${i}" aria-label="Löschen">✕</button></div>`).join('');

  return `
    <div class="daytabs">
      <button class="${ui.shopFromToday ? '' : 'on'}" data-action="shop-range" data-v="0">Ganze Woche</button>
      <button class="${ui.shopFromToday ? 'on' : ''}" data-action="shop-range" data-v="1">Ab heute</button>
    </div>
    ${list}
    <h2>Eigene Einträge</h2>
    <div class="list">
      ${customList}
      <form class="check-row" data-form="add-custom">
        <input name="item" placeholder="z. B. Spülmittel" autocomplete="off">
        <button class="btn small" type="submit">+</button>
      </form>
    </div>
    <button class="btn secondary block" data-action="reset-checks">Häkchen zurücksetzen</button>`;
}

/* ---------- Profil ---------- */

function viewProfile() {
  const p = state.profile;
  const t = targets();
  const num = (key, label, step = 1) => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" step="${step}" data-profile="${key}" value="${p[key]}"></label>`;

  const dayBtns = WEEK_ORDER.map((wd) => `<button class="${state.trainingDays.includes(wd) ? 'on' : ''}" data-action="toggle-day" data-day="${wd}">${WEEKDAYS[wd]}</button>`).join('');

  const levels = PATHS.map((path) => `
    <label class="field"><span>${path.icon} ${esc(path.name)}</span>
      <select data-level="${path.id}">${path.levels.map((l, i) => `<option value="${i}" ${i === currentLevel(path.id).idx ? 'selected' : ''}>${i + 1}. ${esc(l.name)}</option>`).join('')}</select>
    </label>`).join('');

  return `
    <h2>Körperdaten & Ziel</h2>
    <div class="list">
      <label class="field"><span>Geschlecht</span><select data-profile="sex">
        <option value="m" ${p.sex === 'm' ? 'selected' : ''}>männlich</option>
        <option value="f" ${p.sex === 'f' ? 'selected' : ''}>weiblich</option></select></label>
      ${num('age', 'Alter')}
      ${num('height', 'Größe (cm)')}
      ${num('weight', 'Gewicht (kg)', 0.1)}
      <label class="field"><span>Alltag</span><select data-profile="activity">
        ${ACTIVITY.map((a) => `<option value="${a.value}" ${p.activity === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
      <label class="field"><span>Ziel</span><select data-profile="goal">
        ${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
      ${num('proteinPerKg', 'Eiweiß (g pro kg Körpergewicht)', 0.1)}
    </div>
    <div class="card"><div class="flex between"><span>Tagesbedarf</span><b>${n0(t.kcal)} kcal · ${t.protein} g Eiweiß</b></div></div>

    <h2>Ernährungsplan</h2>
    <div class="list">
      <label class="check-row"><input type="checkbox" data-profile-bool="vegetarian" ${p.vegetarian ? 'checked' : ''}><span class="grow">Nur vegetarische Gerichte</span></label>
      <label class="check-row"><input type="checkbox" data-profile-bool="leftovers" ${p.leftovers ? 'checked' : ''}><div class="grow">Reste-Modus<div class="small muted">Mittags gibt's das Abendessen vom Vortag – halb so oft kochen.</div></div></label>
    </div>
    <p class="small muted">Änderungen hier gelten ab dem nächsten neuen Wochenplan (Essen → „Neuen Wochenplan erstellen“).</p>

    <h2>Trainingstage</h2>
    <div class="list"><div class="days">${dayBtns}</div></div>

    <h2>Einstufung (aktuelle Stufe je Skill)</h2>
    <div class="list">${levels}</div>

    <h2>Daten</h2>
    <div class="list">
      <button class="row" data-action="export"><span class="grow">Backup exportieren</span><span class="chev">›</span></button>
      <label class="row"><span class="grow">Backup importieren</span><input type="file" accept="application/json,.json" data-action-change="import" style="display:none"><span class="chev">›</span></label>
      <button class="row" data-action="reset" style="color:#dc2626"><span class="grow">Alle Daten löschen</span></button>
    </div>
    <p class="small muted center">Alle Daten bleiben auf diesem Gerät. Ein Backup ab und zu schadet nicht.</p>`;
}

/* ---------- Router ---------- */

const routes = [
  { re: /^#\/?$/, tab: 'home', title: 'Heute', view: viewHome },
  { re: /^#\/skills$/, tab: 'skills', title: 'Skills', view: viewSkills },
  { re: /^#\/skill\/(\w+)$/, tab: 'skills', title: 'Skill', view: viewSkill },
  { re: /^#\/workout$/, tab: 'home', title: 'Training', view: viewWorkout },
  { re: /^#\/food$/, tab: 'food', title: 'Ernährung', view: viewFood },
  { re: /^#\/shopping$/, tab: 'shopping', title: 'Einkaufsliste', view: viewShopping },
  { re: /^#\/profile$/, tab: 'profile', title: 'Profil', view: viewProfile },
];

function render() {
  const hash = location.hash || '#/';
  const route = routes.find((r) => r.re.test(hash)) || routes[0];
  const args = hash.match(route.re)?.slice(1) || [];
  const inWorkout = route.view === viewWorkout;
  document.body.classList.toggle('workout', inWorkout);
  keepAwake(inWorkout);
  $title.textContent = route.title;
  if (route.view === viewSkill) $title.textContent = getPath(args[0])?.name || 'Skill';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === route.tab));
  $view.innerHTML = route.view(...args);
}

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  closeSheet();
  render();
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
});

/* ---------- Aktionen ---------- */

const actions = {
  'start-workout'() {
    startWorkout();
    ui.pending = null;
    location.hash = '#/workout';
  },
  'warmup-done'() {
    state.activeWorkout.warmupDone = true;
    save();
    render();
    window.scrollTo(0, 0);
  },
  'goto-ex'(el) {
    state.activeWorkout.current = Number(el.dataset.idx);
    ui.pending = null;
    ui.holdStart = null;
    save();
    render();
  },
  step(el) {
    ui.pending = Math.max(0, (ui.pending ?? 0) + Number(el.dataset.d));
    render();
  },
  'save-set'() {
    saveSet(ui.pending ?? 0);
    render();
    window.scrollTo(0, 0);
  },
  'undo-set'() {
    const w = state.activeWorkout;
    w.entries[w.current].logged.pop();
    w.restUntil = null;
    ui.pending = null;
    save();
    render();
  },
  'hold-start'() {
    ui.holdStart = Date.now();
    ui.holdBeeps = 0;
    beep(1, 660);
    render();
  },
  'hold-stop'() {
    ui.pending = Math.round((Date.now() - ui.holdStart) / 1000);
    ui.holdStart = null;
    render();
  },
  'rest-add'() {
    state.activeWorkout.restUntil += 30000;
    save();
    render();
  },
  'rest-skip'() {
    state.activeWorkout.restUntil = null;
    save();
    render();
  },
  'finish-workout'() {
    const w = state.activeWorkout;
    const any = w.entries.some((e) => e.logged.length);
    const allDone = w.entries.every((e) => e.logged.length >= e.sets);
    if (!allDone && !confirm(any ? 'Training jetzt beenden? Erledigte Sätze werden gespeichert.' : 'Training abbrechen? Es wurde noch nichts eingetragen.')) return;
    const snapshot = JSON.parse(JSON.stringify(w));
    const suggestions = finishWorkout();
    ui.pending = null;
    ui.holdStart = null;
    location.hash = '#/';
    if (any) setTimeout(() => showSummary(suggestions, snapshot), 50);
  },
  'accept-level'(el) {
    changeLevel(el.dataset.path, Number(el.dataset.dir));
    el.closest('[data-suggestion]').innerHTML = '<div class="center"><b>Stufe geändert ✅</b></div>';
    render();
  },
  dismiss(el) {
    el.closest('[data-suggestion]').remove();
  },
  'close-sheet'() {
    closeSheet();
  },
  level(el) {
    changeLevel(el.dataset.path, Number(el.dataset.dir));
    render();
  },
  'food-day'(el) {
    ui.foodDay = Number(el.dataset.idx);
    render();
  },
  recipe(el) {
    showRecipe(Number(el.dataset.day), el.dataset.id);
  },
  swap(el) {
    swapMeal(Number(el.dataset.day), el.dataset.slot, Number(el.dataset.index));
    render();
  },
  'new-plan'() {
    if (!confirm('Neuen Wochenplan mit anderen Gerichten erstellen?')) return;
    generatePlan();
    render();
  },
  'shop-range'(el) {
    ui.shopFromToday = el.dataset.v === '1';
    render();
  },
  'reset-checks'() {
    state.shopping.checked = {};
    state.shopping.custom = state.shopping.custom.filter((c) => !c.done);
    save();
    render();
  },
  'del-custom'(el) {
    state.shopping.custom.splice(Number(el.dataset.idx), 1);
    save();
    render();
  },
  'toggle-day'(el) {
    const d = Number(el.dataset.day);
    const days = new Set(state.trainingDays);
    days.has(d) ? days.delete(d) : days.add(d);
    state.trainingDays = [...days].sort();
    save();
    render();
  },
  async export() {
    const json = exportData();
    const name = `calisthenics-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Calisthenics-Backup' }); return; } catch { /* abgebrochen */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset() {
    if (!confirm('Wirklich alle Daten (Trainings, Stufen, Profil) löschen?')) return;
    resetAll();
    location.hash = '#/';
    location.reload();
  },
};

// Checkboxen ändern ihren Zustand selbst, daher über 'change' behandeln
const changeActions = {
  'toggle-path'(el) {
    const id = el.dataset.path;
    state.activePaths = el.checked ? [...new Set([...state.activePaths, id])] : state.activePaths.filter((p) => p !== id);
    save();
    render();
  },
  check(el) {
    state.shopping.checked[el.dataset.id] = el.checked;
    save();
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
  'check-custom'(el) {
    state.shopping.custom[Number(el.dataset.idx)].done = el.checked;
    save();
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
};

document.addEventListener('click', (e) => {
  unlockAudio();
  const el = e.target.closest('[data-action]');
  if (!el || el.type === 'checkbox') return;
  const fn = actions[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action && changeActions[el.dataset.action]) {
    changeActions[el.dataset.action](el);
    return;
  }
  if (el.dataset.profile) {
    const key = el.dataset.profile;
    const v = el.type === 'number' || key === 'activity' ? parseFloat(String(el.value).replace(',', '.')) : el.value;
    if (typeof v === 'number' && !(v > 0)) return render();
    state.profile[key] = v;
    refitPlanTarget();
    save();
    render();
  } else if (el.dataset.profileBool) {
    state.profile[el.dataset.profileBool] = el.checked;
    save();
  } else if (el.dataset.level) {
    state.levels[el.dataset.level] = Number(el.value);
    save();
  } else if (el.dataset.actionChange === 'import' && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        importData(txt);
        alert('Backup importiert.');
        render();
      } catch (err) {
        alert(`Import fehlgeschlagen: ${err.message}`);
      }
    });
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form="add-custom"]');
  if (!form) return;
  e.preventDefault();
  const name = form.item.value.trim();
  if (!name) return;
  state.shopping.custom.push({ name, done: false });
  save();
  render();
  document.querySelector('[data-form="add-custom"] input')?.focus();
});

// Kalorienziel geändert: Portionen im bestehenden Plan neu anpassen
function refitPlanTarget() {
  if (!state.mealPlan) return;
  const { kcal } = targets();
  state.mealPlan.kcal = kcal;
  for (const day of state.mealPlan.days) {
    day.scale = 1;
    const base = dayMacros(day).kcal;
    day.scale = Math.round(Math.max(0.7, Math.min(1.6, kcal / base)) * 20) / 20;
  }
}

/* ---------- Timer ---------- */

setInterval(() => {
  const w = state.activeWorkout;
  if (!w || !document.body.classList.contains('workout')) return;
  if (w.restUntil) {
    const left = (w.restUntil - Date.now()) / 1000;
    const el = document.querySelector('[data-timer="rest"]');
    if (left <= 0) {
      w.restUntil = null;
      save();
      beep(3);
      render();
    } else if (el) {
      el.textContent = fmtClock(left);
    }
  }
  if (ui.holdStart) {
    const entry = w.entries[w.current];
    const sec = (Date.now() - ui.holdStart) / 1000;
    const el = document.querySelector('[data-timer="hold"]');
    if (el) el.textContent = fmtClock(sec);
    if (ui.holdBeeps === 0 && sec >= entry.min) { ui.holdBeeps = 1; beep(1); }
    if (ui.holdBeeps === 1 && sec >= entry.max) { ui.holdBeeps = 2; beep(2, 1100); }
  }
}, 250);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

/* ---------- Start ---------- */

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
