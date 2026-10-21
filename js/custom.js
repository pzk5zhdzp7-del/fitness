// Eigene Übungen: werden wie ein Skill-Pfad behandelt (eine oder mehrere Stufen),
// stehen unter „Übungen“ und laufen in Ganzkörper A, B oder beiden mit.
import { PATHS, SESSIONS, ARCHIVE } from './data/skills.js';
import { state, save } from './store.js';

export const GROUPS = ['Skill', 'Drücken', 'Ziehen', 'Beine', 'Core'];
export const ICONS = ['⭐', '💪', '🔥', '🦵', '🤸', '🧱', '🎯'];

// Eigene Übungen in Übungsliste und Trainings einhängen (idempotent)
export function applyCustomPaths() {
  const list = state.customPaths || [];
  for (let i = PATHS.length - 1; i >= 0; i--) if (PATHS[i].custom) PATHS.splice(i, 1);
  ARCHIVE.splice(0, ARCHIVE.length, ...list.filter((p) => p.deleted));
  for (const s of Object.values(SESSIONS)) s.blocks = s.blocks.filter((b) => !b.some((id) => id.startsWith('cx-')));
  for (const p of list.filter((x) => !x.deleted)) {
    PATHS.push(p);
    for (const key of p.session === 'AB' ? ['A', 'B'] : [p.session]) {
      const s = SESSIONS[key];
      if (!s) continue;
      // Vor den L-Sit am Ende, Core-Übungen danach
      const at = p.group === 'Core' ? s.blocks.length : Math.max(0, s.blocks.length - 1);
      s.blocks.splice(at, 0, [p.id]);
    }
  }
}

export function savePath(data) {
  const list = state.customPaths || [];
  const id = data.id || `cx-${Date.now().toString(36)}`;
  const path = {
    id,
    custom: true,
    name: data.name,
    icon: data.icon || '⭐',
    group: data.group,
    rest: data.rest || 90,
    session: data.session || 'AB',
    levels: data.levels,
  };
  const i = list.findIndex((p) => p.id === id);
  if (i >= 0) list[i] = path;
  else {
    list.push(path);
    state.activePaths = [...new Set([...state.activePaths, id])];
    state.levels[id] = 0;
  }
  state.customPaths = list;
  save();
  applyCustomPaths();
  return path;
}

export function deletePath(id) {
  const p = (state.customPaths || []).find((x) => x.id === id);
  if (!p) return;
  p.deleted = true;
  state.activePaths = state.activePaths.filter((x) => x !== id);
  save();
  applyCustomPaths();
}
