import { state } from '../store.js';
import { SESSIONS, getPath } from '../data/skills.js';
import { getRecipe } from '../data/food.js';
import {
  phaseInfo, calendarDays, dateOnly, buildWorkout, buildMobilityWorkout, estimateMinutes,
  nextSessionKey, workoutsThisWeek, enabledMobility, startOfWeek, strengthHistory,
} from '../training.js';
import { targets, recipeMacros, dayMeals, dayMacros, ensurePlan } from '../nutrition.js';
import { dayTotals, eatenRows } from '../photo.js';
import {
  activityHint, activityButton, activitiesBetween, activityKcal, kcalNote,
} from '../activity.js';
import { esc, n0, todayIdx, isStandalone, fmtDate } from '../ui.js';

export function viewHome() {
  const w = state.activeWorkout;
  const phase = phaseInfo();
  const today = calendarDays(dateOnly(new Date()), 1)[0];
  const done = workoutsThisWeek();
  const goal = state.trainingDays.length;

  let hero;
  if (w) {
    const work = w.steps.filter((s) => s.t !== 'rest').length;
    const doneSteps = w.steps.slice(0, w.pos).filter((s) => s.t !== 'rest').length;
    hero = `
      <div class="card hero">
        <div class="muted small">Training läuft</div>
        <h3>${w.kind === 'mobility' ? 'Beweglichkeit' : SESSIONS[w.session].name}</h3>
        <div class="muted small">${doneSteps} von ${work} Schritten erledigt</div>
        <div style="margin-top:12px"><a class="btn white block" href="#/workout">Training fortsetzen</a></div>
      </div>`;
  } else {
    const key = today.planned || nextSessionKey();
    const preview = buildWorkout(key, phase.key);
    const label = today.done ? 'Heute schon trainiert ✅ – Nächstes Training' : today.planned ? 'Heute ist Trainingstag' : 'Ruhetag – nächstes Training';
    const blocks = preview.blocks.map((b) => b.map((i) => esc(getPath(preview.entries[i].pathId).levels[preview.entries[i].level].name)).join(' + ')).join(' · ');
    hero = `
      <div class="card hero">
        <div class="muted small">${label}</div>
        <h3>${SESSIONS[key].name} · ca. ${estimateMinutes(preview)} Min</h3>
        <div class="muted small">${blocks}</div>
        <div style="margin-top:12px"><button class="btn white block" data-action="start-workout" data-key="${key}">Training starten</button></div>
      </div>`;
  }

  const mob = buildMobilityWorkout();
  const mobCard = enabledMobility().length ? `
    <div class="card flex">
      <span style="font-size:30px">🧘</span>
      <div class="grow"><b>Beweglichkeit</b><div class="small muted">${enabledMobility().length} Dehnübungen · ca. ${estimateMinutes(mob)} Min – ideal an Ruhetagen</div></div>
      <button class="btn secondary small" data-action="start-mobility" ${w ? 'disabled' : ''}>Start</button>
    </div>` : '';

  const plan = ensurePlan();
  const day = plan.days[todayIdx()];
  const t = targets();
  const extra = activityKcal(new Date());
  const kcalGoal = t.kcal + extra;
  const m = dayTotals(todayIdx());
  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    return `<button class="row" data-action="recipe" data-day="${todayIdx()}" data-id="${r.id}">
      <div class="grow"><div class="small muted">${meal.label}</div><div>${esc(r.name)}</div></div>
      <div class="small muted">${n0(mm.kcal)} kcal</div><span class="chev">›</span></button>`;
  }).join('');

  const install = isStandalone() ? '' : `
    <div class="card small">📲 <b>Tipp:</b> In Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b> tippen. Dann startet die App im Vollbild, und deine Daten bleiben dauerhaft gespeichert.</div>`;

  const last = state.history[state.history.length - 1];
  const lastStrength = strengthHistory().slice(-1)[0];
  const hint = w ? '' : activityHint(lastStrength ? new Date(lastStrength.date).getTime() : 0);
  const weekActs = activitiesBetween(startOfWeek(new Date()), new Date(Date.now() + 86400000));
  const actLine = weekActs.length ? `<div class="small muted" style="margin-top:8px">Dazu: ${weekActs.map((a) => `${esc(a.emoji)} ${esc(a.name)}`).join(' · ')}</div>` : '';

  return `
    <a class="card flex phase-card" href="#/plan" style="border-left:5px solid ${phase.color}">
      <div class="grow"><div class="small muted">Zyklus ${phase.cycle} · Woche ${phase.cycleWeek}/7</div>
      <b>${phase.name}</b> <span class="small muted">· Woche ${phase.weekInPhase}/${phase.weeks}</span></div><span class="chev">›</span>
    </a>
    ${hero}
    ${hint}
    ${mobCard}
    <div class="card">
      <div class="flex between"><b>Diese Woche</b><span class="pill ${done >= goal ? 'good' : ''}">${done} / ${goal} Trainings</span></div>
      <div class="progress"><div style="width:${Math.min(100, (done / Math.max(1, goal)) * 100)}%"></div></div>
      ${last ? `<div class="small muted" style="margin-top:8px">Zuletzt: ${fmtDate(last.date)} · ${last.kind === 'mobility' ? 'Beweglichkeit' : SESSIONS[last.session].name}</div>` : ''}
      ${actLine}
    </div>
    ${activityButton()}
    <h2>Essen heute</h2>
    <div class="card">
      <div class="flex between"><span>${n0(m.kcal)} / ${n0(kcalGoal)} kcal</span><span class="muted">${n0(m.p)} g Eiweiß (Ziel ${t.protein} g)</span></div>
      <div class="progress"><div style="width:${Math.min(100, (m.kcal / kcalGoal) * 100)}%"></div></div>
      ${kcalNote()}
    </div>
    <div class="list">${meals}${eatenRows(todayIdx())}</div>
    ${install}`;
}
