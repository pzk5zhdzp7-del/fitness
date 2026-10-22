import { state } from './store.js';
import { getPath, SESSIONS } from './data/skills.js';
import {
  buildWorkout, buildMobilityWorkout, startWorkout, calendarDays, dateOnly, nextSessionKey, phaseInfo,
} from './training.js';
import { ui, closeSheet, keepAwake, unlockAudio, fmtDate } from './ui.js';
import { viewHome } from './views/home.js';
import { viewPlan, planActions } from './views/plan.js';
import { viewExercises, exerciseActions, exerciseChanges, submitExercise } from './views/exercises.js';
import { applyCustomPaths } from './custom.js';
import { viewProgress, viewPath, progressActions, addWeight } from './views/progress.js';
import { viewFood, foodActions, foodChanges, addCustom, submitRecipe } from './views/food.js';
import { viewProfile, profileActions, profileChange } from './views/profile.js';
import { viewPlayer, playerActions, beginWorkout, tick } from './views/player.js';
import { start as startSync, onRemoteChange } from './sync.js';
import { refreshCustom } from './recipes.js';
import { photoActions, submitEatenOut } from './photo.js';
import { activityActions, submitActivity, configureActivity } from './activity.js';

const $view = document.getElementById('view');
const $title = document.getElementById('title');

const routes = [
  { re: /^#\/?$/, tab: 'home', title: 'Heute', view: viewHome },
  { re: /^#\/plan$/, tab: 'plan', title: 'Plan', view: viewPlan },
  { re: /^#\/exercises$/, tab: 'exercises', title: 'Übungen', view: viewExercises },
  { re: /^#\/progress$/, tab: 'progress', title: 'Fortschritt', view: viewProgress },
  { re: /^#\/path\/(\w+)$/, tab: 'progress', title: 'Skill', view: viewPath },
  { re: /^#\/food$/, tab: 'food', title: 'Ernährung', view: viewFood },
  { re: /^#\/profile$/, tab: 'profile', title: 'Profil', view: viewProfile },
  { re: /^#\/workout$/, tab: 'home', title: 'Training', view: viewPlayer },
];

function render() {
  applyCustomPaths();
  const hash = location.hash || '#/';
  const route = routes.find((r) => r.re.test(hash)) || routes[0];
  const args = hash.match(route.re)?.slice(1) || [];
  const inWorkout = route.view === viewPlayer;
  document.body.classList.toggle('workout', inWorkout);
  keepAwake(inWorkout);
  $title.textContent = route.view === viewPath ? getPath(args[0])?.name || 'Skill' : route.title;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === route.tab));
  $view.innerHTML = route.view(...args);
}
ui.render = render;

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  closeSheet();
  render();
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
});

function begin(workout) {
  startWorkout(workout);
  beginWorkout();
  location.hash = '#/workout';
}

const actions = {
  ...planActions,
  ...exerciseActions,
  ...progressActions,
  ...foodActions,
  ...photoActions,
  ...activityActions,
  ...profileActions,
  ...playerActions,
  'start-workout'(el) {
    if (state.activeWorkout) { location.hash = '#/workout'; return; }
    begin(buildWorkout(el.dataset.key));
  },
  'start-mobility'() {
    if (state.activeWorkout) return;
    begin(buildMobilityWorkout());
  },
  'close-sheet'() {
    closeSheet();
  },
};

const changeActions = { ...exerciseChanges, ...foodChanges };

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
  if (el.dataset.action && changeActions[el.dataset.action]) changeActions[el.dataset.action](el);
  else profileChange(el);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'add-custom') addCustom(form);
  if (form.dataset.form === 'weight') addWeight(form);
  if (form.dataset.form === 'recipe') submitRecipe(form);
  if (form.dataset.form === 'eaten-out') submitEatenOut(form);
  if (form.dataset.form === 'activity') submitActivity(form);
  if (form.dataset.form === 'exercise') submitExercise(form);
});

setInterval(tick, 250);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// Was Claude über den Plan wissen muss, um anderes Training einzuordnen
configureActivity({
  context() {
    const next = calendarDays(dateOnly(new Date()), 14).find((d) => d.planned);
    const key = next?.planned || nextSessionKey();
    const names = buildWorkout(key).entries.map((e) => getPath(e.pathId).levels[e.level].name).join(', ');
    const when = next ? fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'demnächst';
    return `Calisthenics mit Skill-Progressionen (Handstand, Planche, Front Lever usw.), Ganzkörper A/B im Wechsel, ${state.trainingDays.length}× pro Woche, aktuell Phase „${phaseInfo().name}“. Nächstes Training: ${SESSIONS[key].name} am ${when} (${names}).`;
  },
});

refreshCustom();
render();

// Änderungen aus der anderen App: neu zeichnen, aber nicht während einer Eingabe
let syncTimer = null;
onRemoteChange(() => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    refreshCustom();
    const busy = document.activeElement?.matches('input:not([type=checkbox]):not([type=file]), select, textarea');
    const sheetOpen = !document.getElementById('sheet').classList.contains('hidden');
    if (!busy && !sheetOpen) render();
  }, 150);
});
startSync();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
