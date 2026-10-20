// Übungen-Tab: alle Übungen mit An/Aus für die Planerstellung
import { state, save } from '../store.js';
import { PATHS, WARMUP, getPath } from '../data/skills.js';
import { MOBILITY, getMobility } from '../data/mobility.js';
import { currentLevel, resolveLevel, setLevel, pathHistory } from '../training.js';
import { esc, fmtTarget, unitOf, fmtDate, videoLink, openSheet, closeSheet, lineChart, rerender } from '../ui.js';

function off(p) {
  const n = p.levels.filter((_, i) => state.excluded[`${p.id}:${i}`]).length;
  return `(${p.levels.length}${n ? `, ${n} aus` : ''})`;
}

export function viewExercises() {
  const paths = PATHS.map((p) => {
    const { idx } = currentLevel(p.id);
    const active = state.activePaths.includes(p.id);
    const res = resolveLevel(p.id);
    const rows = p.levels.map((l, i) => {
      const off = state.excluded[`${p.id}:${i}`];
      const cur = i === idx;
      const used = active && res && res.idx === i;
      return `<div class="row ex-row ${off ? 'off' : ''}">
        <button class="grow ex-name" data-action="ex-info" data-path="${p.id}" data-idx="${i}">
          <div>${i + 1}. ${esc(l.name)} ${cur ? '<span class="pill">aktuell</span>' : ''}${used && !cur ? '<span class="pill warn">Ersatz</span>' : ''}</div>
          <div class="small muted">${fmtTarget(l)}</div></button>
        <input type="checkbox" class="switch" data-action="toggle-ex" data-key="${p.id}:${i}" ${off ? '' : 'checked'} aria-label="${esc(l.name)} im Plan">
      </div>`;
    }).join('');
    return `
      <div class="list ${active ? '' : 'path-off'}">
        <div class="row path-head">
          <span class="icon">${p.icon}</span>
          <a class="grow" href="#/path/${p.id}"><b>${esc(p.name)}</b><div class="small muted">Stufe ${idx + 1}: ${esc(p.levels[idx].name)}</div></a>
          <input type="checkbox" class="switch" data-action="toggle-path" data-path="${p.id}" ${active ? 'checked' : ''} aria-label="${esc(p.name)} im Plan">
        </div>
        ${active ? `<details class="levels"><summary>Stufen ${off(p)}</summary>${rows}</details>` : '<div class="row small muted">Pausiert – wird nicht trainiert.</div>'}
      </div>`;
  }).join('');

  const mob = MOBILITY.map((m) => {
    const off = state.excluded[`mob:${m.id}`];
    return `<div class="row ex-row ${off ? 'off' : ''}">
      <button class="grow ex-name" data-action="mob-info" data-id="${m.id}">
        <div>${esc(m.name)}</div><div class="small muted">${m.sets} × ${m.sec ? `${m.sec} s` : `${m.reps} Wdh.`}${m.side ? ' je Seite' : ''} · ${esc(m.focus)}</div></button>
      <input type="checkbox" class="switch" data-action="toggle-ex" data-key="mob:${m.id}" ${off ? '' : 'checked'} aria-label="${esc(m.name)} im Plan">
    </div>`;
  }).join('');

  return `
    <p class="small muted" style="margin-top:0">Schalte Übungen aus, die du nicht machen kannst oder willst. Ist deine aktuelle Stufe ausgeschaltet, nimmt der Plan die nächstleichtere Variante. Mit dem Schalter beim Skill pausierst du ihn ganz.</p>
    <h2>Skills & Kraft</h2>
    ${paths}
    <h2>Beweglichkeit</h2>
    <p class="small muted">Eingeschaltete Übungen kommen ins Cool-down (4 pro Training, rotierend) und in die Mobility-Einheit.</p>
    <div class="list">${mob}</div>
    <h2>Aufwärmen</h2>
    <div class="list">${WARMUP.map((w) => `<div class="row"><div class="grow"><div>${esc(w.name)}</div><div class="small muted">${w.sec ? `${w.sec} s` : `${w.reps}×`}${w.sets ? ` × ${w.sets}` : ''}</div></div></div>`).join('')}</div>`;
}

function exInfo(pathId, idx) {
  const p = getPath(pathId);
  const l = p.levels[idx];
  const hist = pathHistory(pathId).filter((h) => h.level === idx);
  const cur = currentLevel(pathId).idx === idx;
  openSheet(`
    <div class="small muted">${p.icon} ${esc(p.name)} · Stufe ${idx + 1}/${p.levels.length}</div>
    <h3>${esc(l.name)}</h3>
    <div class="small muted">Grundziel: ${fmtTarget(l)}</div>
    <p>${esc(l.cues)}</p>
    ${videoLink(l.name)}
    ${hist.length >= 2 ? `<h2>Bester Satz</h2><div class="card">${lineChart(hist.map((h) => h.best))}</div>` : ''}
    ${hist.length ? `<h2>Verlauf</h2><div class="list">${hist.slice(-5).reverse().map((h) => `<div class="row"><div class="grow small">${fmtDate(h.date)}</div><div class="small">${h.sets.join(' · ')} ${unitOf(h)}</div></div>`).join('')}</div>` : '<p class="small muted">Noch nicht trainiert.</p>'}
    ${cur ? '' : `<button class="btn block" data-action="set-level" data-path="${pathId}" data-idx="${idx}" style="margin-top:10px">Als aktuelle Stufe setzen</button>`}
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:8px">Schließen</button>`);
}

function mobInfo(id) {
  const m = getMobility(id);
  const count = state.history.filter((h) => h.kind === 'mobility').length;
  openSheet(`
    <div class="small muted">🧘 Beweglichkeit · ${esc(m.focus)}</div>
    <h3>${esc(m.name)}</h3>
    <div class="small muted">${m.sets} × ${m.sec ? `${m.sec} s` : `${m.reps} Wdh.`}${m.side ? ' je Seite' : ''}</div>
    <p>${esc(m.cues)}</p>
    ${videoLink(m.name)}
    <p class="small muted">Bisher ${count} Mobility-Einheiten absolviert.</p>
    <button class="btn secondary block" data-action="close-sheet">Schließen</button>`);
}

export const exerciseActions = {
  'ex-info'(el) {
    exInfo(el.dataset.path, Number(el.dataset.idx));
  },
  'mob-info'(el) {
    mobInfo(el.dataset.id);
  },
  'set-level'(el) {
    setLevel(el.dataset.path, Number(el.dataset.idx));
    closeSheet();
    rerender();
  },
};

// Schalter (change-Events)
export const exerciseChanges = {
  'toggle-ex'(el) {
    if (el.checked) delete state.excluded[el.dataset.key];
    else state.excluded[el.dataset.key] = true;
    save();
    rerender();
  },
  'toggle-path'(el) {
    const id = el.dataset.path;
    state.activePaths = el.checked ? [...new Set([...state.activePaths, id])] : state.activePaths.filter((p) => p !== id);
    save();
    rerender();
  },
};
