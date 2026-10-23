// Übungen-Tab: alle Übungen mit An/Aus für die Planerstellung
import { state, save } from '../store.js';
import { PATHS, WARMUP, getPath } from '../data/skills.js';
import { GROUPS, ICONS, savePath, deletePath } from '../custom.js';
import { MOBILITY, getMobility } from '../data/mobility.js';
import { currentLevel, resolveLevel, setLevel, pathHistory } from '../training.js';
import { MUSCLES, pathMuscles } from '../data/muscles.js';
import { bodyMap } from '../body.js';
import { soreNote } from '../soreness.js';
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
          <a class="grow" href="#/path/${p.id}"><b>${esc(p.name)}</b>${p.custom ? ' <span class="pill">eigene</span>' : ''}<div class="small muted">Stufe ${idx + 1}: ${esc(p.levels[idx].name)}</div></a>
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
    <button class="btn block" data-action="cx-new" style="margin-top:10px">＋ Eigene Übung</button>
    <p class="small muted">Eigene Übungen laufen wie die Skills mit: mit Zielbereich, Steigerung und, wenn du mehrere Stufen anlegst, Aufstieg zur nächsten Stufe.</p>
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
  const { muscles, muscles2 } = pathMuscles(pathId);
  openSheet(`
    <div class="small muted">${p.icon} ${esc(p.name)} · Stufe ${idx + 1}/${p.levels.length}</div>
    <h3>${esc(l.name)}</h3>
    <div class="small muted">Grundziel: ${fmtTarget(l)}</div>
    ${soreNote(muscles, muscles2)}
    <p>${esc(l.cues)}</p>
    ${muscles.length ? `<div class="card bodycard">${bodyMap(muscles, muscles2)}
      <div class="small"><span class="dot m1"></span>${muscles.map((m) => MUSCLES[m]).join(', ')}
      ${muscles2.length ? `<br><span class="dot m2"></span><span class="muted">${muscles2.map((m) => MUSCLES[m]).join(', ')}</span>` : ''}</div></div>` : ''}
    ${videoLink(l.name)}
    ${hist.length >= 2 ? `<h2>Bester Satz</h2><div class="card">${lineChart(hist.map((h) => h.best))}</div>` : ''}
    ${hist.length ? `<h2>Verlauf</h2><div class="list">${hist.slice(-5).reverse().map((h) => `<div class="row"><div class="grow small">${fmtDate(h.date)}</div><div class="small">${h.sets.join(' · ')} ${unitOf(h)}</div></div>`).join('')}</div>` : '<p class="small muted">Noch nicht trainiert.</p>'}
    ${cur ? '' : `<button class="btn block" data-action="set-level" data-path="${pathId}" data-idx="${idx}" style="margin-top:10px">Als aktuelle Stufe setzen</button>`}
    ${p.custom && !p.deleted ? `<button class="btn secondary block" data-action="cx-edit" data-id="${p.id}" style="margin-top:8px">Übung bearbeiten</button>
      <button class="btn ghost block" data-action="cx-delete" data-id="${p.id}">Übung löschen</button>` : ''}
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

/* ---------- Eigene Übung anlegen / bearbeiten ---------- */

const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;

function levelBlock(l = {}, i = 0) {
  return `<div class="list cx-level">
    <div class="row path-head"><b class="grow">Stufe <span class="cx-no">${i + 1}</span></b>
      <button type="button" class="btn ghost small" data-action="cx-del-level" aria-label="Stufe entfernen">✕</button></div>
    <label class="field"><span>Name der Variante</span><input name="l-name" value="${esc(l.name || '')}" autocomplete="off" placeholder="${i ? 'z. B. mit Gewichtsweste' : 'z. B. Archer Push-up'}"></label>
    <label class="field"><span>Gezählt wird</span><select name="l-type">${opt('reps', 'Wiederholungen', l.type || 'reps')}${opt('hold', 'Sekunden halten', l.type)}</select></label>
    <label class="field"><span>Sätze</span><select name="l-sets">${[2, 3, 4, 5].map((n) => opt(n, `${n} Sätze`, l.sets || 3)).join('')}</select></label>
    <div class="flex" style="padding:10px 16px;gap:10px">
      <label class="grow"><span class="small muted">Ziel von</span><input name="l-min" type="text" inputmode="numeric" value="${l.min ?? 6}"></label>
      <label class="grow"><span class="small muted">bis</span><input name="l-max" type="text" inputmode="numeric" value="${l.max ?? 12}"></label>
    </div>
    <label class="check-row"><span class="grow">Gilt je Seite / Bein</span><input type="checkbox" class="switch" name="l-side" ${l.side ? 'checked' : ''}></label>
    <label class="field"><span>Ausführung</span><textarea name="l-cues" rows="3" placeholder="Worauf kommt es an?">${esc(l.cues || '')}</textarea></label>
  </div>`;
}

function renumber() {
  document.querySelectorAll('.cx-level .cx-no').forEach((n, i) => { n.textContent = i + 1; });
}

function pathEditor(p = null) {
  openSheet(`
    <form data-form="exercise" ${p ? `data-id="${p.id}"` : ''}>
      <h3>${p ? 'Übung bearbeiten' : 'Eigene Übung'}</h3>
      <div class="list">
        <label class="field"><span>Name</span><input name="cx-name" value="${esc(p?.name || '')}" autocomplete="off" placeholder="z. B. Archer Push-up"></label>
        <label class="field"><span>Symbol</span><select name="cx-icon">${ICONS.map((i) => opt(i, i, p?.icon || '⭐')).join('')}</select></label>
        <label class="field"><span>Bereich</span><select name="cx-group">${GROUPS.map((g) => opt(g, g, p?.group || 'Drücken')).join('')}</select></label>
        <label class="field"><span>Trainieren in</span><select name="cx-session">${opt('AB', 'Ganzkörper A und B', p?.session || 'AB')}${opt('A', 'Nur Ganzkörper A', p?.session)}${opt('B', 'Nur Ganzkörper B', p?.session)}</select></label>
        <label class="field"><span>Pause zwischen den Sätzen</span><select name="cx-rest">${[60, 90, 120, 180].map((n) => opt(n, `${n} Sekunden`, p?.rest || 90)).join('')}</select></label>
      </div>
      <h2>Stufen (von leicht nach schwer)</h2>
      <p class="small muted">Schaffst du in allen Sätzen das obere Ende, schlägt die App die nächste Stufe vor. Eine Stufe reicht, wenn du einfach nur Wiederholungen steigern willst.</p>
      <div id="cx-levels">${(p?.levels || [{}]).map(levelBlock).join('')}</div>
      <button type="button" class="btn secondary block" data-action="cx-add-level">＋ Schwerere Stufe</button>
      <p class="small warn" id="cx-error"></p>
      <button class="btn block" type="submit" style="margin-top:10px">Speichern</button>
      <button class="btn secondary block" type="button" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>
    </form>`);
}

export function submitExercise(form) {
  const error = (msg) => { form.querySelector('#cx-error').textContent = msg; };
  const f = (n) => form.querySelector(`[name="cx-${n}"]`);
  const name = f('name').value.trim();
  if (!name) return error('Bitte gib der Übung einen Namen.');
  const levels = [];
  for (const b of form.querySelectorAll('.cx-level')) {
    const v = (n) => b.querySelector(`[name="l-${n}"]`);
    const min = parseInt(v('min').value, 10);
    const max = parseInt(v('max').value, 10);
    if (!(min > 0 && max >= min)) return error('Bitte bei jeder Stufe einen Zielbereich eintragen, z. B. 6 bis 12.');
    levels.push({
      name: v('name').value.trim() || (levels.length ? `${name} (Stufe ${levels.length + 1})` : name),
      type: v('type').value,
      sets: Number(v('sets').value),
      min,
      max,
      ...(v('side').checked ? { side: true } : {}),
      cues: v('cues').value.trim(),
    });
  }
  const p = savePath({
    id: form.dataset.id || undefined,
    name,
    icon: f('icon').value,
    group: f('group').value,
    session: f('session').value,
    rest: Number(f('rest').value),
    levels,
  });
  closeSheet();
  rerender();
  exInfo(p.id, 0);
}

export const exerciseActions = {
  'cx-new'() {
    pathEditor();
  },
  'cx-edit'(el) {
    pathEditor(getPath(el.dataset.id));
  },
  'cx-delete'(el) {
    if (!confirm(`„${getPath(el.dataset.id).name}“ löschen? Dein bisheriger Verlauf bleibt erhalten.`)) return;
    deletePath(el.dataset.id);
    closeSheet();
    rerender();
  },
  'cx-add-level'() {
    const box = document.getElementById('cx-levels');
    box.insertAdjacentHTML('beforeend', levelBlock({}, box.children.length));
  },
  'cx-del-level'(el) {
    if (document.querySelectorAll('.cx-level').length > 1) el.closest('.cx-level').remove();
    renumber();
  },
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
