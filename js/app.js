import { state } from './store.js';
import { getPath } from './data/skills.js';
import { buildWorkout, buildMobilityWorkout, startWorkout } from './training.js';
import { ui, closeSheet, keepAwake, unlockAudio } from './ui.js';
import { viewHome } from './views/home.js';
import { viewPlan, planActions } from './views/plan.js';
import { viewExercises, exerciseActions, exerciseChanges } from './views/exercises.js';
import { viewProgress, viewPath, progressActions, addWeight } from './views/progress.js';
import { viewFood, foodActions, foodChanges, addCustom } from './views/food.js';
import { viewProfile, profileActions, profileChange } from './views/profile.js';
import { viewPlayer, playerActions, beginWorkout, tick } from './views/player.js';

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
});

setInterval(tick, 250);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
