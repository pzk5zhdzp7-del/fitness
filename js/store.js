// Alle Daten liegen lokal im Browser (localStorage). Export/Import als JSON-Backup.
import { DEFAULT_LEVELS } from './data/skills.js';
import { MOBILITY } from './data/mobility.js';

const KEY = 'calisthenics-app-v1';

function mondayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultExcluded() {
  const ex = {};
  MOBILITY.filter((m) => m.off).forEach((m) => { ex[`mob:${m.id}`] = true; });
  return ex;
}

const DEFAULTS = {
  profile: {
    sex: 'm',
    age: 30,
    height: 180,
    weight: 75,
    activity: 1.55,
    goal: 'maintain',
    proteinPerKg: 1.8,
    vegetarian: false,
    leftovers: false,
  },
  settings: { voice: true, cooldown: true },
  trainingDays: [1, 3, 5], // 0 = Sonntag … 6 = Samstag
  programStart: null, // Montag, an dem der aktuelle Zyklus begonnen hat
  levels: { ...DEFAULT_LEVELS },
  activePaths: Object.keys(DEFAULT_LEVELS),
  excluded: null, // { 'dips:2': true, 'mob:bridge': true } = für den Plan abgewählt
  failStreak: {},
  history: [],
  levelLog: [],
  weights: [],
  activeWorkout: null,
  mealPlan: null,
  shopping: { weekStart: null, checked: {}, custom: [] },
  customPaths: [], // eigene Übungen (siehe custom.js)
  activities: [], // anderes Training wie Fußball oder Joggen (siehe activity.js)
  eatenOut: [], // auswärts gegessen, nur für diese Person (siehe photo.js)
  customRecipes: [], // eigene Rezepte (siehe recipes.js)
  customIngredients: {},
  recipeOff: [], // abgewählte Rezepte, kommen nicht in den Wochenplan
  sync: {}, // { db, code, name, member } = gemeinsamer Ernährungsplan (siehe sync.js)
  syncQueue: [],
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function fill(data) {
  const s = {
    ...clone(DEFAULTS),
    ...data,
    profile: { ...DEFAULTS.profile, ...data.profile },
    settings: { ...DEFAULTS.settings, ...data.settings },
    levels: { ...DEFAULTS.levels, ...data.levels },
  };
  if (!s.programStart) s.programStart = mondayIso();
  if (!s.excluded) s.excluded = defaultExcluded();
  // Laufende Trainings aus der alten Version (ohne Ablaufschritte) verwerfen
  if (s.activeWorkout && !s.activeWorkout.steps) s.activeWorkout = null;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return fill(raw ? JSON.parse(raw) : {});
  } catch {
    return fill({});
  }
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
  }
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (typeof data !== 'object' || !data.profile) throw new Error('Keine gültige Sicherung');
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fill(data));
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
}

export { mondayIso };

// Bittet iOS/Safari, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
