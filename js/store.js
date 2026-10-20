// Alle Daten liegen lokal im Browser (localStorage). Export/Import als JSON-Backup.
import { DEFAULT_LEVELS } from './data/skills.js';

const KEY = 'calisthenics-app-v1';

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
  trainingDays: [1, 3, 5], // 0 = Sonntag … 6 = Samstag
  levels: { ...DEFAULT_LEVELS },
  activePaths: Object.keys(DEFAULT_LEVELS),
  failStreak: {},
  history: [],
  activeWorkout: null,
  mealPlan: null,
  shopping: { weekStart: null, checked: {}, custom: [] },
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULTS);
    const data = JSON.parse(raw);
    return {
      ...clone(DEFAULTS),
      ...data,
      profile: { ...DEFAULTS.profile, ...data.profile },
      levels: { ...DEFAULTS.levels, ...data.levels },
    };
  } catch {
    return clone(DEFAULTS);
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
  Object.assign(state, clone(DEFAULTS), data);
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
}

// Bittet iOS/Safari, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
