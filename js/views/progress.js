// Fortschritt: Statistik, Skill-Stufen, Meilensteine, Körpergewicht, Verlauf
import { state, save } from '../store.js';
import { PATHS, SESSIONS, getPath } from '../data/skills.js';
import {
  currentLevel, pathHistory, weeklySets, weekStreak, strengthHistory, changeLevel, PHASES,
} from '../training.js';
import {
  esc, fmtDate, fmtTarget, unitOf, videoLink, openSheet, lineChart, barChart, rerender,
} from '../ui.js';
import { activityList, activityButton } from '../activity.js';

export function viewProgress() {
  const strength = strengthHistory();
  const mobilityCount = state.history.length - strength.length;
  const weeks = weeklySets(8);
  const totalLevels = PATHS.reduce((a, p) => a + currentLevel(p.id).idx, 0);
  const ups = state.levelLog.filter((l) => l.to > l.from);

  const skills = PATHS.map((p) => {
    const { idx, level } = currentLevel(p.id);
    const first = state.levelLog.find((l) => l.pathId === p.id);
    const start = first ? first.from : idx;
    const gained = idx - start;
    return `<a class="row" href="#/path/${p.id}"><span class="icon">${p.icon}</span>
      <div class="grow"><div class="flex"><b>${esc(p.name)}</b>${gained > 0 ? `<span class="pill good">+${gained}</span>` : ''}</div>
      <div class="small muted">Stufe ${idx + 1}/${p.levels.length}: ${esc(level.name)}</div>
      <div class="progress"><div style="width:${((idx + 1) / p.levels.length) * 100}%"></div></div></div><span class="chev">›</span></a>`;
  }).join('');

  const milestones = ups.slice(-6).reverse().map((l) => {
    const p = getPath(l.pathId);
    return `<div class="row"><span class="icon">🏅</span><div class="grow"><div>${esc(p.levels[l.to].name)}</div>
      <div class="small muted">${esc(p.name)} · ${fmtDate(l.date)}</div></div></div>`;
  }).join('');

  const w = state.weights;
  const weightChart = w.length >= 2 ? lineChart(w.slice(-20).map((x) => x.kg)) : '';

  const hist = state.history.slice(-15).reverse().map((h, i) => {
    const idx = state.history.length - 1 - i;
    const title = h.kind === 'mobility' ? '🧘 Beweglichkeit' : `💪 ${SESSIONS[h.session].name}`;
    const info = h.kind === 'mobility' ? `${h.mobility} Übungen` : `${h.entries.reduce((a, e) => a + e.sets.length, 0)} Sätze`;
    return `<button class="row" data-action="history" data-idx="${idx}"><div class="grow"><div>${title}</div>
      <div class="small muted">${fmtDate(h.date)} · ${Math.round(h.duration / 60)} Min · ${info}${h.phase ? ` · ${PHASES[h.phase].name}` : ''}</div></div><span class="chev">›</span></button>`;
  }).join('');

  return `
    <div class="stats">
      <div class="card"><div class="big">${strength.length}</div><div class="small muted">Trainings</div></div>
      <div class="card"><div class="big">${weekStreak()}</div><div class="small muted">Wochen in Folge</div></div>
      <div class="card"><div class="big">${ups.length}</div><div class="small muted">Stufen-Aufstiege</div></div>
      <div class="card"><div class="big">${mobilityCount}</div><div class="small muted">Mobility-Einheiten</div></div>
    </div>
    <h2>Sätze pro Woche</h2>
    <div class="card">${barChart(weeks.map((x) => x.sets), weeks.map((x) => fmtDate(x.from, { day: 'numeric', month: 'numeric' })))}</div>
    <h2>Skills · ${totalLevels} Stufen gesamt</h2>
    <div class="list">${skills}</div>
    ${milestones ? `<h2>Meilensteine</h2><div class="list">${milestones}</div>` : ''}
    <h2>Körpergewicht</h2>
    <div class="card">
      ${weightChart || '<div class="small muted">Trage regelmäßig dein Gewicht ein, um den Verlauf zu sehen.</div>'}
      <form class="flex" data-form="weight" style="margin-top:10px">
        <input name="kg" type="text" inputmode="decimal" autocomplete="off" placeholder="${state.profile.weight} kg">
        <button class="btn small" type="submit">Eintragen</button>
      </form>
      ${w.length ? `<div class="small muted" style="margin-top:6px">Zuletzt: ${w[w.length - 1].kg.toLocaleString('de-DE')} kg am ${fmtDate(w[w.length - 1].date)}</div>` : ''}
    </div>
    <h2>Verlauf</h2>
    ${hist ? `<div class="list">${hist}</div>` : '<div class="empty">Noch keine Trainings. Los geht\'s! 💪</div>'}
    <h2>Anderes Training</h2>
    ${activityList() ? `<div class="list">${activityList()}</div>` : '<p class="small muted">Fußball, Joggen, Radtour? Beschreib es kurz, Claude trägt es ein.</p>'}
    ${activityButton()}`;
}

export function viewPath(id) {
  const path = getPath(id);
  if (!path) return '<div class="empty">Nicht gefunden</div>';
  const { idx, level } = currentLevel(id);
  const hist = pathHistory(id);
  const atLevel = hist.filter((h) => h.level === idx).slice(-15);
  const levelLine = hist.map((h) => h.level + 1);

  const ladder = path.levels.map((l, i) => `
    <li class="${i < idx ? 'done' : i === idx ? 'current' : ''}">
      <span class="dot">${i < idx ? '✓' : i + 1}</span>
      <div class="grow"><div><b>${esc(l.name)}</b></div><div class="small muted">${fmtTarget(l)}</div>
      <details ${i === idx ? 'open' : ''}><summary>Ausführung</summary><p class="small">${esc(l.cues)}</p>${videoLink(l.name)}</details>
      </div></li>`).join('');

  const recent = hist.slice(-8).reverse().map((h) => `
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
    </div>
    ${atLevel.length >= 2 ? `<h2>Bester Satz auf aktueller Stufe</h2><div class="card">${lineChart(atLevel.map((h) => h.best))}</div>` : ''}
    ${levelLine.length >= 2 && new Set(levelLine).size > 1 ? `<h2>Stufe über die Zeit</h2><div class="card">${lineChart(levelLine)}</div>` : ''}
    <h2>Stufen</h2>
    <ul class="ladder list">${ladder}</ul>
    ${recent ? `<h2>Verlauf</h2><div class="list">${recent}</div>` : ''}`;
}

function historyDetails(idx) {
  const h = state.history[idx];
  if (!h) return;
  const rows = (h.entries || []).map((e) => {
    const p = getPath(e.pathId);
    return `<div class="row"><span class="icon">${p.icon}</span><div class="grow"><div>${esc(p.levels[e.level].name)}</div>
      <div class="small muted">${e.sets.join(' · ')} ${unitOf(e)}${e.targets ? ` · Ziel ${e.targets.join(' · ')}` : ''}</div></div></div>`;
  }).join('');
  openSheet(`<h3>${h.kind === 'mobility' ? 'Beweglichkeit' : SESSIONS[h.session].name}</h3>
    <div class="small muted">${fmtDate(h.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${Math.round(h.duration / 60)} Min${h.phase ? ` · ${PHASES[h.phase].name}` : ''}</div>
    ${rows ? `<div class="list" style="margin-top:12px">${rows}</div>` : ''}
    ${h.mobility ? `<p class="small muted">🧘 ${h.mobility} Dehnübungen</p>` : ''}
    <button class="btn secondary block" data-action="delete-history" data-idx="${idx}" style="margin-top:10px">Training löschen</button>
    <button class="btn block" data-action="close-sheet" style="margin-top:8px">Schließen</button>`);
}

export const progressActions = {
  history(el) {
    historyDetails(Number(el.dataset.idx));
  },
  'delete-history'(el) {
    if (!confirm('Dieses Training aus dem Verlauf löschen?')) return;
    state.history.splice(Number(el.dataset.idx), 1);
    save();
    document.getElementById('sheet').classList.add('hidden');
    rerender();
  },
  level(el) {
    changeLevel(el.dataset.path, Number(el.dataset.dir));
    rerender();
  },
};

export function addWeight(form) {
  const kg = parseFloat(String(form.kg.value).replace(',', '.'));
  if (!(kg > 20 && kg < 400)) return;
  state.weights.push({ date: new Date().toISOString(), kg });
  state.profile.weight = kg;
  save();
  rerender();
}
