// Plan-Tab: Periodisierung und Kalender
import { state } from '../store.js';
import { SESSIONS, getPath } from '../data/skills.js';
import {
  PHASES, CYCLE, phaseInfo, calendarDays, dateOnly, buildWorkout, estimateMinutes, restartCycle,
} from '../training.js';
import { esc, fmtDate, unitOf, openSheet, rerender } from '../ui.js';
import { activitiesOn, activityRow, calendarMark } from '../activity.js';

const DAY = 86400000;

export function viewPlan() {
  const phase = phaseInfo();
  const cycleStart = new Date(dateOnly(state.programStart).getTime() + (phase.cycle - 1) * CYCLE.length * 7 * DAY);
  const days = calendarDays(cycleStart, CYCLE.length * 7);

  const segs = CYCLE.map((k, i) => `<div class="seg ${i + 1 === phase.cycleWeek ? 'now' : ''}" style="background:${PHASES[k].color}${i + 1 < phase.cycleWeek ? '' : i + 1 === phase.cycleWeek ? '' : '55'}"></div>`).join('');

  let weeks = '';
  for (let wk = 0; wk < CYCLE.length; wk++) {
    const p = PHASES[CYCLE[wk]];
    const cells = days.slice(wk * 7, wk * 7 + 7).map((d) => {
      let mark = '';
      if (d.done) mark = `<span class="tag done">${d.done} ✓</span>`;
      else if (d.planned) mark = `<span class="tag">${d.planned}</span>`;
      else if (d.missed) mark = '<span class="tag missed">–</span>';
      const iso = d.date.toISOString();
      return `<button class="cal-day ${d.isToday ? 'today' : ''} ${d.past ? 'past' : ''}" data-action="cal-day" data-date="${iso}" data-key="${d.planned || ''}">
        <span class="num">${d.date.getDate()}</span>${mark}${d.mobility ? '<span class="dot-mob"></span>' : ''}${calendarMark(d.date)}</button>`;
    }).join('');
    weeks += `<div class="cal-week"><div class="cal-label" style="color:${p.color}">Woche ${wk + 1} · ${p.name}</div><div class="cal-grid">${cells}</div></div>`;
  }

  return `
    <div class="card" style="border-left:5px solid ${phase.color}">
      <div class="small muted">Zyklus ${phase.cycle} · Woche ${phase.cycleWeek} von 7</div>
      <h3>${phase.name} <span class="small muted">· Woche ${phase.weekInPhase}/${phase.weeks}</span></h3>
      <p class="small" style="margin:6px 0 10px">${phase.desc}</p>
      <div class="segs">${segs}</div>
    </div>
    <div class="cal-head">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span>${d}</span>`).join('')}</div>
    ${weeks}
    <p class="small muted">A/B = geplantes Training · ✓ = erledigt · <span class="dot-mob" style="position:static;display:inline-block"></span> = Beweglichkeit. Tippe auf einen Tag für Details. Trainingstage änderst du im Profil.</p>
    <h2>So funktioniert der Zyklus</h2>
    <div class="list">${Object.values(PHASES).map((p) => `
      <div class="row"><span class="seg-dot" style="background:${p.color}"></span><div class="grow"><b>${p.name}</b><div class="small muted">${p.desc}</div></div></div>`).join('')}
    </div>
    <button class="btn secondary block" data-action="restart-cycle">Zyklus ab dieser Woche neu starten</button>`;
}

function dayDetails(dateIso, key) {
  const date = new Date(dateIso);
  const phase = phaseInfo(date);
  const done = state.history.filter((h) => dateOnly(h.date).getTime() === dateOnly(date).getTime());
  let body = '';

  for (const h of done) {
    if (h.kind === 'mobility') {
      body += `<div class="card">🧘 <b>Beweglichkeit</b> · ${Math.round(h.duration / 60)} Min · ${h.mobility} Übungen</div>`;
      continue;
    }
    body += `<h2>${SESSIONS[h.session].name} · ${Math.round(h.duration / 60)} Min</h2><div class="list">${h.entries.map((e) => {
      const p = getPath(e.pathId);
      return `<div class="row"><span class="icon">${p.icon}</span><div class="grow"><div>${esc(p.levels[e.level].name)}</div>
        <div class="small muted">${e.sets.join(' · ')} ${unitOf(e)}${e.targets ? ` (Ziel ${e.targets.join(' · ')})` : ''}</div></div></div>`;
    }).join('')}</div>`;
  }

  const acts = activitiesOn(date);
  if (acts.length) body += `<h2>Anderes Training</h2><div class="list">${acts.map((a) => activityRow(a, false)).join('')}</div>`;

  if (key) {
    const w = buildWorkout(key, phase.key);
    body += `<h2>Geplant: ${SESSIONS[key].name} · ca. ${estimateMinutes(w)} Min</h2>
      <div class="list">${w.blocks.map((b) => {
        const rows = b.map((i) => {
          const e = w.entries[i];
          const p = getPath(e.pathId);
          return `<div class="row"><span class="icon">${p.icon}</span><div class="grow"><div>${esc(p.levels[e.level].name)}</div>
            <div class="small muted">${e.sets} Sätze · Ziele ${e.targets.join(' · ')} ${unitOf(e)}${p.levels[e.level].side ? ' je Seite' : ''} · Pause ${e.rest} s</div></div></div>`;
        }).join('');
        return b.length > 1 ? `<div class="ss-group"><div class="ss-label">Supersatz · im Wechsel</div>${rows}</div>` : rows;
      }).join('')}</div>
      <p class="small muted">Die Ziele passen sich nach jedem Training an deine Leistung an.</p>`;
    if (dateOnly(date).getTime() === dateOnly(new Date()).getTime() && !state.activeWorkout) {
      body += `<button class="btn block" data-action="start-workout" data-key="${key}">Jetzt starten</button>`;
    }
  }
  if (!body) body = '<div class="empty">Kein Training geplant – Ruhetag. 😌<br>Eine Einheit Beweglichkeit passt immer.</div>';

  openSheet(`<h3>${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
    <div class="small muted">${phase.name} · Woche ${phase.cycleWeek}/7</div>${body}
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:10px">Schließen</button>`);
}

export const planActions = {
  'cal-day'(el) {
    dayDetails(el.dataset.date, el.dataset.key || null);
  },
  'restart-cycle'() {
    if (!confirm('Zyklus ab dieser Woche neu starten? Du beginnst wieder mit Woche 1 (Hypertrophie).')) return;
    restartCycle();
    rerender();
  },
};
