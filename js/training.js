import { PATHS, SESSIONS, getPath } from './data/skills.js';
import { state, save } from './store.js';

export function nextSessionKey() {
  const last = state.history[state.history.length - 1];
  if (!last) return 'A';
  return last.session === 'A' ? 'B' : 'A';
}

export function currentLevel(pathId) {
  const path = getPath(pathId);
  const idx = Math.min(state.levels[pathId] ?? 0, path.levels.length - 1);
  return { idx, level: path.levels[idx], path };
}

// Letzte geloggte Werte für dieselbe Übung (Pfad + Stufe)
export function lastResult(pathId, levelIdx) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const e = state.history[i].entries.find((x) => x.pathId === pathId && x.level === levelIdx);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

export function buildWorkout(key) {
  const session = SESSIONS[key];
  const entries = session.paths
    .filter((id) => state.activePaths.includes(id))
    .map((pathId) => {
      const { idx, level, path } = currentLevel(pathId);
      const last = lastResult(pathId, idx);
      return {
        pathId,
        level: idx,
        type: level.type,
        sets: level.sets,
        min: level.min,
        max: level.max,
        rest: path.rest,
        last,
        logged: [],
      };
    });
  return {
    session: key,
    started: Date.now(),
    warmupDone: false,
    current: 0,
    restUntil: null,
    entries,
  };
}

export function startWorkout(key = nextSessionKey()) {
  state.activeWorkout = buildWorkout(key);
  save();
  return state.activeWorkout;
}

// Wertet das Training aus und liefert Vorschläge für Stufenwechsel
export function finishWorkout() {
  const w = state.activeWorkout;
  if (!w) return [];
  const suggestions = [];
  const entries = w.entries
    .filter((e) => e.logged.length)
    .map((e) => ({ pathId: e.pathId, level: e.level, type: e.type, sets: e.logged }));

  for (const e of w.entries) {
    if (!e.logged.length) continue;
    const path = getPath(e.pathId);
    const allMax = e.logged.length >= e.sets && e.logged.every((v) => v >= e.max);
    const allBelowMin = e.logged.every((v) => v < e.min);
    if (allMax && e.level < path.levels.length - 1) {
      suggestions.push({ pathId: e.pathId, dir: 1, from: e.level });
      state.failStreak[e.pathId] = 0;
    } else if (allBelowMin) {
      state.failStreak[e.pathId] = (state.failStreak[e.pathId] || 0) + 1;
      if (state.failStreak[e.pathId] >= 2 && e.level > 0) {
        suggestions.push({ pathId: e.pathId, dir: -1, from: e.level });
      }
    } else {
      state.failStreak[e.pathId] = 0;
    }
  }

  if (entries.length) {
    state.history.push({
      date: new Date().toISOString(),
      session: w.session,
      duration: Math.round((Date.now() - w.started) / 1000),
      entries,
    });
  }
  state.activeWorkout = null;
  save();
  return suggestions;
}

export function changeLevel(pathId, dir) {
  const path = getPath(pathId);
  const next = Math.max(0, Math.min(path.levels.length - 1, (state.levels[pathId] ?? 0) + dir));
  state.levels[pathId] = next;
  state.failStreak[pathId] = 0;
  save();
}

export function workoutsThisWeek() {
  const start = startOfWeek(new Date());
  return state.history.filter((h) => new Date(h.date) >= start).length;
}

export function startOfWeek(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // Montag = 0
  date.setDate(date.getDate() - day);
  return date;
}

// Verlauf einer Übung: pro Training der beste Satz, mit Stufe
export function pathHistory(pathId) {
  const out = [];
  for (const h of state.history) {
    const e = h.entries.find((x) => x.pathId === pathId);
    if (e) out.push({ date: h.date, level: e.level, best: Math.max(...e.sets), sets: e.sets, type: e.type });
  }
  return out;
}

export { PATHS };
