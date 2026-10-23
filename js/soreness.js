// Muskelkater je Muskelpartie: 1 = leicht, 2 = mittel, 3 = stark.
// Ein Eintrag pro Tag. Er gilt am Tag selbst und am Tag danach, bis ein neuer kommt.
import { state, save } from './store.js';
import { esc, fmtDate, openSheet, closeSheet, rerender } from './ui.js';
import { soreMap } from './body.js';
import { isoDay } from './activity.js';

export const SORE = ['–', 'leicht', 'mittel', 'stark'];
const DAY = 86400000;

// Die App liefert Muskelnamen und die Übungen ihrer Trainings (siehe app.js).
// Ein Training: { date, name, items: [{ name, muscles, muscles2 }] }
let cfg = { muscles: {}, lastWorkout: () => null, nextWorkout: () => null };
export function configureSoreness(c) {
  cfg = { ...cfg, ...c };
}

let draft = null; // { date, levels }

function day(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ---------- Daten ---------- */

function entries() {
  if (!Array.isArray(state.soreness)) state.soreness = [];
  return state.soreness;
}

// Aktueller Muskelkater (heute oder gestern eingetragen), sonst null
export function currentSoreness() {
  const yesterday = isoDay(Date.now() - DAY);
  const e = entries().filter((x) => x.date >= yesterday && x.date <= isoDay()).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  return e && Object.keys(e.levels).length ? e : null;
}

// Betroffene Muskeln einer Übung; Hilfsmuskeln zählen eine Stufe schwächer
export function soreHits(muscles = [], muscles2 = []) {
  const e = currentSoreness();
  if (!e) return [];
  return [...new Set([...muscles, ...muscles2])]
    .filter((m) => e.levels[m])
    .map((m) => ({ m, level: e.levels[m], weight: muscles.includes(m) ? e.levels[m] : e.levels[m] - 1 }));
}

function affected(item) {
  return soreHits(item.muscles, item.muscles2).some((h) => h.weight > 0);
}

function levelText(levels) {
  return Object.entries(levels).sort((a, b) => b[1] - a[1]).map(([m, l]) => `${cfg.muscles[m] || m} ${SORE[l]}`).join(' · ');
}

/* ---------- Anzeige ---------- */

// Hinweis bei einer Übung (Training, Übungsdetails)
export function soreNote(muscles, muscles2) {
  const hits = soreHits(muscles, muscles2).filter((h) => h.weight > 0);
  if (!hits.length) return '';
  const worst = Math.max(...hits.map((h) => h.weight));
  const names = hits.map((h) => `${cfg.muscles[h.m] || h.m} ${SORE[h.level]}`).join(', ');
  const tip = worst >= 3
    ? 'Heute lieber leichter: weniger Sätze, weniger Last oder eine leichtere Variante. Sticht es, die Übung auslassen.'
    : worst >= 2
      ? 'Gründlich aufwärmen und sauber trainieren. Lockere Bewegung hilft sogar, solange nichts sticht.'
      : 'Normal trainieren ist in Ordnung.';
  return `<div class="card small sore-note">😣 <b>Muskelkater:</b> ${esc(names)}. ${tip}</div>`;
}

export function sorenessButton() {
  return currentSoreness() ? '' : '<button class="btn secondary block" data-action="sore-start">😣 Muskelkater eintragen</button>';
}

// Karte auf der Startseite, solange Muskelkater eingetragen ist
export function sorenessCard() {
  const e = currentSoreness();
  if (!e) return '';
  const next = cfg.nextWorkout();
  const hit = next ? next.items.filter(affected).map((i) => i.name) : [];
  return `
    <div class="card flex sore-card">
      <div class="sore-mini">${soreMap(e.levels)}</div>
      <div class="grow">
        <b>Muskelkater</b> <span class="small muted">· ${e.date === isoDay() ? 'heute eingetragen' : 'seit gestern'}</span>
        <div class="small">${esc(levelText(e.levels))}</div>
        ${hit.length ? `<div class="small muted" style="margin-top:4px">Betrifft im nächsten Training: ${esc(hit.join(', '))}</div>` : next ? '<div class="small muted" style="margin-top:4px">Das nächste Training ist davon kaum betroffen.</div>' : ''}
        <div class="flex" style="margin-top:8px">
          <button class="btn secondary small" data-action="sore-start">Ändern</button>
          <button class="btn ghost small" data-action="sore-gone">Ist weg ✓</button>
        </div>
      </div>
    </div>`;
}

// Verlauf (Fortschritt)
export function sorenessList(n = 8) {
  const list = entries().filter((e) => Object.keys(e.levels).length).slice(-n).reverse();
  if (!list.length) return '<p class="small muted">Noch kein Muskelkater eingetragen.</p>';
  return `<div class="list">${list.map((e) => `
    <button class="row" data-action="sore-start" data-date="${e.date}"><span class="icon">😣</span>
      <div class="grow"><div>${fmtDate(day(e.date))}</div><div class="small muted">${esc(levelText(e.levels))}</div></div><span class="chev">›</span></button>`).join('')}</div>`;
}

/* ---------- Eintragen ---------- */

function row(k) {
  const cur = draft.levels[k] || 0;
  return `<div class="row sore-row"><div class="grow">${esc(cfg.muscles[k])}</div>
    <div class="sore-seg">${SORE.map((label, l) => `<button type="button" class="s${l} ${cur === l ? 'on' : ''}" data-action="sore-set" data-m="${k}" data-l="${l}">${label}</button>`).join('')}</div></div>`;
}

function editor() {
  const last = cfg.lastWorkout();
  const recent = last ? [...new Set(last.items.flatMap((i) => [...i.muscles, ...(i.muscles2 || [])]))].filter((k) => cfg.muscles[k]) : [];
  const rest = Object.keys(cfg.muscles).filter((k) => !recent.includes(k));
  return `
    ${soreMap(draft.levels, true)}
    <p class="small muted center" style="margin-top:4px">Muskel antippen: leicht → mittel → stark → aus</p>
    ${recent.length ? `<h2>Letztes Training</h2>
      <p class="small muted" style="margin:0 4px 8px">${fmtDate(last.date)} · ${esc(last.name)}: ${esc(last.items.map((i) => i.name).join(', '))}</p>
      <div class="list">${recent.map(row).join('')}</div>` : ''}
    <h2>${recent.length ? 'Weitere Muskeln' : 'Muskeln'}</h2>
    <div class="list">${rest.map(row).join('')}</div>`;
}

function refresh() {
  const el = document.getElementById('sore-edit');
  if (el) el.innerHTML = editor();
}

function start(date) {
  const iso = date || isoDay();
  const own = entries().find((e) => e.date === iso);
  // Heute ohne eigenen Eintrag: mit dem Stand von gestern anfangen
  const base = own || (date ? null : currentSoreness());
  draft = { date: iso, levels: { ...(base?.levels || {}) } };
  const past = iso !== isoDay();
  openSheet(`
    <h3>😣 Muskelkater${past ? ` am ${fmtDate(day(iso), { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}</h3>
    <p class="small muted">Wo spürst du ihn und wie stark? Beim Training siehst du dann, welche Übungen betroffen sind.</p>
    <div id="sore-edit">${editor()}</div>
    <button class="btn block" data-action="sore-save" style="margin-top:8px">Speichern</button>
    ${own && past ? `<button class="btn ghost block" data-action="sore-delete" style="margin-top:8px">Eintrag löschen</button>` : ''}
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>`);
}

function store(date, levels) {
  const clean = Object.fromEntries(Object.entries(levels).filter(([, l]) => l > 0));
  const limit = isoDay(Date.now() - 365 * DAY);
  const list = entries().filter((e) => e.date !== date && e.date >= limit);
  // Ein leerer Eintrag für heute heißt „kein Muskelkater mehr“ und überdeckt den von gestern
  if (Object.keys(clean).length || date === isoDay()) list.push({ date, levels: clean, added: Date.now() });
  state.soreness = list.sort((a, b) => (a.date < b.date ? -1 : 1));
  save();
}

export const sorenessActions = {
  'sore-start'(el) {
    start(el.dataset.date || '');
  },
  'sore-tap'(el) {
    const m = el.dataset.m;
    draft.levels[m] = ((draft.levels[m] || 0) + 1) % SORE.length;
    refresh();
  },
  'sore-set'(el) {
    draft.levels[el.dataset.m] = Number(el.dataset.l);
    refresh();
  },
  'sore-save'() {
    store(draft.date, draft.levels);
    draft = null;
    closeSheet();
    rerender();
  },
  'sore-delete'() {
    if (!confirm('Eintrag löschen?')) return;
    state.soreness = entries().filter((e) => e.date !== draft.date);
    save();
    draft = null;
    closeSheet();
    rerender();
  },
  'sore-gone'() {
    store(isoDay(), {});
    rerender();
  },
};
