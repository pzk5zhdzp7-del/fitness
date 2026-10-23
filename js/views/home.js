import { state } from '../store.js';
import { SESSIONS, getPath } from '../data/skills.js';
import { getRecipe } from '../data/food.js';
import {
  phaseInfo, calendarDays, dateOnly, buildWorkout, buildMobilityWorkout, estimateMinutes,
  nextSessionKey, workoutsThisWeek, enabledMobility, startOfWeek, strengthHistory, CYCLE,
} from '../training.js';
import { targets, recipeMacros, dayMeals, ensurePlan } from '../nutrition.js';
import { dayTotals, eatenRows, eatButton, planDate, replacedKeys, mealKey } from '../photo.js';
import {
  activityHint, activityButton, activitiesBetween, activityKcal, kcalNote, isoDay,
} from '../activity.js';
import { sorenessCard, sorenessButton } from '../soreness.js';
import { dayContent } from './plan.js';
import { ui, esc, n0, isStandalone, fmtDate } from '../ui.js';

function viewToday() {
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
    ${sorenessCard()}
    ${mobCard}
    <div class="card">
      <div class="flex between"><b>Diese Woche</b><span class="pill ${done >= goal ? 'good' : ''}">${done} / ${goal} Trainings</span></div>
      <div class="progress"><div style="width:${Math.min(100, (done / Math.max(1, goal)) * 100)}%"></div></div>
      ${last ? `<div class="small muted" style="margin-top:8px">Zuletzt: ${fmtDate(last.date)} · ${last.kind === 'mobility' ? 'Beweglichkeit' : SESSIONS[last.session].name}</div>` : ''}
      ${actLine}
    </div>
    ${activityButton()}
    ${sorenessButton()}
    ${foodSection(new Date(), 'Essen heute')}
    ${install}`;
}

/* ---------- Andere Tage ---------- */

const DAY_NAMES = { '-2': 'Vorgestern', '-1': 'Gestern', 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' };

// Der Tag, den die Startseite gerade zeigt
function shownDate() {
  const d = dateOnly(new Date());
  d.setDate(d.getDate() + ui.homeOffset);
  return d;
}

export function homeTitle() {
  return DAY_NAMES[ui.homeOffset] || fmtDate(shownDate(), { weekday: 'long' });
}

function dayNav() {
  const date = shownDate();
  const off = ui.homeOffset;
  const sub = fmtDate(date, DAY_NAMES[off] ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div class="day-nav">
      <button class="btn ghost" data-action="home-day" data-dir="-1" aria-label="Vorheriger Tag">‹</button>
      <button class="plain grow" data-action="home-day" data-dir="0" ${off ? '' : 'disabled'}>
        <b>${homeTitle()}</b><div class="small muted">${sub}</div>
        ${off ? '<div class="small to-today">Zurück zu heute</div>' : ''}</button>
      <button class="btn ghost" data-action="home-day" data-dir="1" aria-label="Nächster Tag">›</button>
    </div>`;
}

// Essen eines Tages; den Plan gibt es nur für die laufende Woche
function foodSection(date, heading = 'Essen') {
  const plan = ensurePlan();
  if (isoDay(startOfWeek(date)) !== plan.weekStart) {
    return `<h2>${heading}</h2><div class="card small muted">Der Essensplan gilt immer für die laufende Woche (Montag bis Sonntag). Für diesen Tag gibt es keinen.</div>`;
  }
  const idx = (date.getDay() + 6) % 7;
  const day = plan.days[idx];
  const t = targets();
  const kcalGoal = t.kcal + activityKcal(date);
  const m = dayTotals(idx);
  const replaced = replacedKeys(planDate(idx));
  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    const out = replaced.has(mealKey(meal));
    return `<div class="row ${out ? 'ex-row off' : ''}">
      ${out ? '<span class="eat-spacer"></span>' : eatButton(idx, meal)}
      <button class="grow plain row-btn ex-name" data-action="recipe" data-day="${idx}" data-id="${r.id}">
        <div class="grow"><div class="small muted">${meal.label}${out ? ' · etwas anderes gegessen' : ''}</div><div>${esc(r.name)}</div></div>
        <div class="small muted">${n0(mm.kcal)} kcal</div><span class="chev">›</span></button></div>`;
  }).join('');
  return `
    <h2>${heading}</h2>
    <div class="card">
      <div class="flex between"><span>${n0(m.kcal)} / ${n0(kcalGoal)} kcal gegessen</span><span class="muted">${n0(m.p)} g Eiweiß (Ziel ${t.protein} g)</span></div>
      <div class="progress"><div style="width:${Math.min(100, (m.kcal / kcalGoal) * 100)}%"></div></div>
      ${m.open ? `<div class="small muted" style="margin-top:6px">Hake ab, was du gegessen hast. Nur das zählt.</div>` : ''}
      ${kcalNote(date)}
    </div>
    <div class="list">${meals}${eatenRows(idx)}</div>
    <button class="btn secondary block" data-action="eo-start" data-day="${idx}">🍽️ Etwas anderes gegessen</button>`;
}

function viewDay(date) {
  const today = dateOnly(new Date());
  const past = date < today;
  const phase = phaseInfo(date);
  const key = past ? null : calendarDays(today, ui.homeOffset + 1).find((d) => isoDay(d.date) === isoDay(date))?.planned || null;
  const training = dayContent(date, key)
    || `<div class="empty">${past ? 'An diesem Tag ist kein Training eingetragen.' : 'Kein Training geplant: Ruhetag. 😌'}</div>`;
  return `
    <div class="card" style="border-left:5px solid ${phase.color}">
      <div class="small muted">Zyklus ${phase.cycle} · Woche ${phase.cycleWeek}/${CYCLE.length}</div>
      <b>${phase.name}</b> <span class="small muted">· Woche ${phase.weekInPhase}/${phase.weeks}</span>
    </div>
    ${training}
    ${past ? activityButton('🏃 Anderes Training an diesem Tag', isoDay(date)) : ''}
    ${foodSection(date, `Essen ${DAY_NAMES[ui.homeOffset]?.toLowerCase() || `am ${fmtDate(date, { weekday: 'long' })}`}`)}`;
}

export function viewHome() {
  return dayNav() + (ui.homeOffset ? viewDay(shownDate()) : viewToday());
}
