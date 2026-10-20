import { PATHS, SESSIONS, WARMUP, getPath } from './data/skills.js';
import { MOBILITY, getMobility } from './data/mobility.js';
import { state, save, mondayIso } from './store.js';

/* ---------- Periodisierung ---------- */

// Ein Zyklus = 7 Wochen: 3× Hypertrophie, 3× Kraft, 1× Deload
export const PHASES = {
  hyp: {
    name: 'Hypertrophie', color: '#2563eb',
    desc: 'Muskelaufbau: ein Satz mehr, kürzere Pausen, Wiederholungen bis ans obere Ende des Zielbereichs.',
  },
  str: {
    name: 'Kraft', color: '#dc2626',
    desc: 'Maximalkraft: längere Pausen, weniger Wiederholungen – dafür steigst du schon in der Mitte des Zielbereichs auf die schwerere Variante auf.',
  },
  deload: {
    name: 'Deload', color: '#16a34a',
    desc: 'Entlastungswoche: weniger Sätze, lockere Ziele. Sehnen und Gelenke erholen sich, danach bist du stärker.',
  },
};
export const CYCLE = ['hyp', 'hyp', 'hyp', 'str', 'str', 'str', 'deload'];
const REST_FACTOR = { hyp: 0.75, str: 1.4, deload: 1 };
const DAY = 86400000;

export function dateOnly(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function phaseInfo(date = new Date()) {
  const start = dateOnly(state.programStart);
  const weekIdx = Math.max(0, Math.floor((dateOnly(date) - start) / DAY / 7));
  const w = weekIdx % CYCLE.length;
  const key = CYCLE[w];
  const first = CYCLE.indexOf(key);
  const weeks = CYCLE.filter((k) => k === key).length;
  return { key, ...PHASES[key], cycle: Math.floor(weekIdx / CYCLE.length) + 1, cycleWeek: w + 1, weekInPhase: w - first + 1, weeks };
}

export function restartCycle() {
  state.programStart = mondayIso();
  save();
}

function phaseSets(level, phase) {
  if (phase === 'hyp') return Math.min(level.sets + 1, 5);
  if (phase === 'deload') return Math.max(2, level.sets - 1);
  return level.sets;
}

// Ab diesem Wert in allen Sätzen wird die nächste Stufe vorgeschlagen
export function goalCap(level, phase) {
  return phase === 'str' ? Math.ceil((level.min + level.max) / 2) : level.max;
}

/* ---------- Stufen & abgewählte Übungen ---------- */

export function isExcluded(pathId, idx) {
  return !!state.excluded[`${pathId}:${idx}`];
}

// Aktuelle Stufe; ist sie abgewählt, die nächstleichtere (sonst nächstschwerere) erlaubte
export function resolveLevel(pathId) {
  const path = getPath(pathId);
  const cur = Math.min(state.levels[pathId] ?? 0, path.levels.length - 1);
  if (!isExcluded(pathId, cur)) return { idx: cur, substituted: false };
  for (let i = cur - 1; i >= 0; i--) if (!isExcluded(pathId, i)) return { idx: i, substituted: true };
  for (let i = cur + 1; i < path.levels.length; i++) if (!isExcluded(pathId, i)) return { idx: i, substituted: true };
  return null;
}

export function currentLevel(pathId) {
  const path = getPath(pathId);
  const idx = Math.min(state.levels[pathId] ?? 0, path.levels.length - 1);
  return { idx, level: path.levels[idx], path };
}

function nextAllowed(pathId, from, dir) {
  const path = getPath(pathId);
  for (let i = from + dir; i >= 0 && i < path.levels.length; i += dir) {
    if (!isExcluded(pathId, i)) return i;
  }
  return null;
}

export function setLevel(pathId, to) {
  const from = state.levels[pathId] ?? 0;
  if (to === from) return;
  state.levels[pathId] = to;
  state.failStreak[pathId] = 0;
  state.levelLog.push({ date: new Date().toISOString(), pathId, from, to });
  save();
}

export function changeLevel(pathId, dir) {
  const path = getPath(pathId);
  const cur = state.levels[pathId] ?? 0;
  setLevel(pathId, Math.max(0, Math.min(path.levels.length - 1, cur + dir)));
}

/* ---------- Satz-Ziele ---------- */

export function lastEntry(pathId, levelIdx) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const e = (state.history[i].entries || []).find((x) => x.pathId === pathId && x.level === levelIdx);
    if (e && e.sets.length) return e;
  }
  return null;
}

// Doppelprogression: Ziel erreicht → +1 Wdh. (bzw. +1–2 s), sonst Ziel wiederholen
export function setTargets(level, last, phase, sets) {
  if (phase === 'deload' || !last) return Array(sets).fill(level.min);
  const cap = goalCap(level, phase);
  return Array.from({ length: sets }, (_, i) => {
    const done = last.sets[i] ?? last.sets[last.sets.length - 1];
    const prevTarget = last.targets?.[i];
    let t;
    if (prevTarget && done < prevTarget) t = prevTarget;
    else t = done + (level.type === 'hold' ? (done < 10 ? 1 : 2) : 1);
    return Math.max(level.min, Math.min(cap, t));
  });
}

/* ---------- Training zusammenstellen ---------- */

function warmupSteps() {
  const steps = [];
  WARMUP.forEach((w, i) => {
    for (let s = 0; s < (w.sets || 1); s++) {
      steps.push({ t: 'warm', i, s, sets: w.sets || 1, sec: w.sec, reps: w.reps, sect: 'Aufwärmen' });
    }
  });
  return steps;
}

function mobilitySteps(items, sect) {
  const steps = [];
  for (const m of items) {
    for (let s = 0; s < m.sets; s++) {
      for (const side of m.side ? ['links', 'rechts'] : [null]) {
        steps.push({ t: 'mob', id: m.id, s, side, sec: m.sec, reps: m.reps, sect });
      }
    }
  }
  return steps;
}

export function enabledMobility() {
  return MOBILITY.filter((m) => !state.excluded[`mob:${m.id}`]);
}

// 4 Dehnübungen pro Cool-down, rotierend
export function cooldownItems() {
  const list = enabledMobility();
  if (!list.length) return [];
  const n = Math.min(4, list.length);
  const offset = (state.history.filter((h) => h.kind !== 'mobility').length * n) % list.length;
  return Array.from({ length: n }, (_, i) => list[(offset + i) % list.length]);
}

export function buildWorkout(key, phase = phaseInfo().key) {
  const entries = [];
  const blocks = [];
  for (const block of SESSIONS[key].blocks) {
    const idxs = [];
    for (const pathId of block) {
      if (!state.activePaths.includes(pathId)) continue;
      const res = resolveLevel(pathId);
      if (!res) continue;
      const path = getPath(pathId);
      const level = path.levels[res.idx];
      const sets = phaseSets(level, phase);
      const last = lastEntry(pathId, res.idx);
      idxs.push(entries.length);
      entries.push({
        pathId,
        level: res.idx,
        substituted: res.substituted,
        type: level.type,
        sets,
        min: level.min,
        max: level.max,
        cap: goalCap(level, phase),
        rest: Math.round((path.rest * REST_FACTOR[phase]) / 5) * 5,
        targets: setTargets(level, last, phase, sets),
        last: last ? last.sets : null,
        logged: [],
      });
    }
    if (idxs.length) blocks.push(idxs);
  }

  const steps = warmupSteps();
  let ssNo = 0;
  blocks.forEach((b, bi) => {
    const isSS = b.length > 1;
    const sect = isSS ? `Supersatz ${++ssNo}` : bi === 0 && entries[b[0]].pathId === 'handstand' ? 'Skill-Block' : getPath(entries[b[0]].pathId).name;
    const rounds = Math.max(...b.map((i) => entries[i].sets));
    const ssRest = Math.round((Math.max(...b.map((i) => entries[i].rest)) * 0.6) / 5) * 5;
    if (isSS) b.forEach((i) => { entries[i].rest = ssRest; });
    for (let r = 0; r < rounds; r++) {
      for (const e of b) {
        if (r >= entries[e].sets) continue;
        steps.push({ t: 'set', e, s: r, round: r + 1, rounds, sect, ss: isSS });
        steps.push({ t: 'rest', sec: isSS ? ssRest : entries[e].rest, sect });
      }
    }
  });
  // Keine Pause nach dem letzten Satz
  if (steps.length && steps[steps.length - 1].t === 'rest') steps.pop();

  const cooldown = state.settings.cooldown ? cooldownItems() : [];
  steps.push(...mobilitySteps(cooldown, 'Cool-down'));

  return { kind: 'strength', session: key, phase, started: null, entries, blocks, steps, pos: 0, stepStart: null };
}

export function buildMobilityWorkout() {
  const steps = mobilitySteps(enabledMobility(), 'Beweglichkeit');
  return { kind: 'mobility', session: null, phase: phaseInfo().key, started: null, entries: [], blocks: [], steps, pos: 0, stepStart: null };
}

export function estimateMinutes(w) {
  let sec = 0;
  for (const st of w.steps) {
    if (st.t === 'rest') sec += st.sec;
    else if (st.t === 'set') sec += w.entries[st.e].type === 'hold' ? 40 : 35;
    else sec += st.sec ? st.sec + 5 : 30;
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

export function nextSessionKey() {
  const last = [...state.history].reverse().find((h) => h.kind !== 'mobility');
  if (!last) return 'A';
  return last.session === 'A' ? 'B' : 'A';
}

export function startWorkout(w) {
  w.started = Date.now();
  w.stepStart = Date.now();
  state.activeWorkout = w;
  save();
  return w;
}

/* ---------- Auswerten ---------- */

export function finishWorkout() {
  const w = state.activeWorkout;
  if (!w) return null;
  const suggestions = [];
  const records = [];
  const entries = [];

  for (const e of w.entries) {
    const values = e.logged.filter((v) => v != null);
    if (!values.length) continue;
    const prevBest = bestAtLevel(e.pathId, e.level);
    const best = Math.max(...values);
    if (prevBest !== null && best > prevBest) records.push({ pathId: e.pathId, level: e.level, best, prevBest, type: e.type });
    entries.push({ pathId: e.pathId, level: e.level, type: e.type, sets: values, targets: e.targets.slice(0, values.length) });

    if (w.phase === 'deload') continue;
    const allCap = values.length >= e.sets && values.every((v) => v >= e.cap);
    const allBelow = values.every((v) => v < e.min);
    if (allCap) {
      const to = nextAllowed(e.pathId, e.level, 1);
      if (to !== null) suggestions.push({ pathId: e.pathId, from: e.level, to, dir: 1 });
      state.failStreak[e.pathId] = 0;
    } else if (allBelow) {
      state.failStreak[e.pathId] = (state.failStreak[e.pathId] || 0) + 1;
      const to = nextAllowed(e.pathId, e.level, -1);
      if (state.failStreak[e.pathId] >= 2 && to !== null) suggestions.push({ pathId: e.pathId, from: e.level, to, dir: -1 });
    } else {
      state.failStreak[e.pathId] = 0;
    }
  }

  const mobilityDone = w.steps.filter((st, i) => st.t === 'mob' && i < w.pos).length;
  const duration = Math.round((Date.now() - w.started) / 1000);
  const saved = entries.length || (w.kind === 'mobility' && mobilityDone);
  if (saved) {
    state.history.push({
      date: new Date().toISOString(),
      kind: w.kind,
      session: w.session,
      phase: w.phase,
      duration,
      mobility: mobilityDone,
      entries,
    });
  }
  state.activeWorkout = null;
  save();
  return { saved: !!saved, suggestions, records, duration, sets: entries.reduce((a, e) => a + e.sets.length, 0), kind: w.kind, mobility: mobilityDone };
}

function bestAtLevel(pathId, level) {
  let best = null;
  for (const h of state.history) {
    for (const e of h.entries || []) {
      if (e.pathId === pathId && e.level === level) best = Math.max(best ?? 0, ...e.sets);
    }
  }
  return best;
}

/* ---------- Statistik ---------- */

export function startOfWeek(d) {
  const date = dateOnly(d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

export function strengthHistory() {
  return state.history.filter((h) => h.kind !== 'mobility');
}

export function workoutsThisWeek() {
  const start = startOfWeek(new Date());
  return strengthHistory().filter((h) => new Date(h.date) >= start).length;
}

// Sätze pro Woche für die letzten n Wochen (älteste zuerst)
export function weeklySets(n = 8) {
  const start = startOfWeek(new Date());
  return Array.from({ length: n }, (_, i) => {
    const from = new Date(start.getTime() - (n - 1 - i) * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const sets = strengthHistory()
      .filter((h) => new Date(h.date) >= from && new Date(h.date) < to)
      .reduce((a, h) => a + h.entries.reduce((b, e) => b + e.sets.length, 0), 0);
    return { from, sets };
  });
}

// Wochen in Folge mit mindestens einem Training (aktuelle Woche zählt, wenn schon trainiert)
export function weekStreak() {
  let streak = 0;
  const start = startOfWeek(new Date());
  for (let i = 0; i < 520; i++) {
    const from = new Date(start.getTime() - i * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const any = strengthHistory().some((h) => new Date(h.date) >= from && new Date(h.date) < to);
    if (any) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function pathHistory(pathId) {
  const out = [];
  for (const h of state.history) {
    const e = (h.entries || []).find((x) => x.pathId === pathId);
    if (e) out.push({ date: h.date, level: e.level, best: Math.max(...e.sets), sets: e.sets, type: e.type });
  }
  return out;
}

/* ---------- Kalender ---------- */

// Plant die kommenden Trainingstage (A/B im Wechsel) ab heute
export function calendarDays(from, days) {
  const today = dateOnly(new Date());
  const trainedToday = strengthHistory().some((h) => dateOnly(h.date).getTime() === today.getTime());
  let key = nextSessionKey();
  const firstDay = state.history.length ? dateOnly(state.history[0].date) : today;
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * DAY);
    const done = state.history.filter((h) => dateOnly(h.date).getTime() === d.getTime());
    const strength = done.find((h) => h.kind !== 'mobility');
    const mobility = done.some((h) => h.kind === 'mobility');
    const isTrainingDay = state.trainingDays.includes(d.getDay());
    let planned = null;
    const upcoming = d > today || (d.getTime() === today.getTime() && !trainedToday);
    if (isTrainingDay && upcoming) {
      planned = key;
      key = key === 'A' ? 'B' : 'A';
    }
    out.push({
      date: d,
      isToday: d.getTime() === today.getTime(),
      past: d < today,
      missed: isTrainingDay && d < today && d >= firstDay && !strength,
      isTrainingDay,
      planned,
      done: strength ? strength.session : null,
      mobility,
      phase: phaseInfo(d).key,
    });
  }
  return out;
}

export { PATHS, MOBILITY, getMobility };
