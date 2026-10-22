// Anderes Training (Fußball, Joggen, Radtour …) frei beschreiben, Claude macht daraus Einträge.
// Standard: über die Claude-App (Anfrage teilen, Antwort einfügen). Mit dem API-Schlüssel aus
// „Auswärts gegessen“ geht es auch direkt aus der App.
import { state, save } from './store.js';
import { esc, n0, fmtDate, openSheet, closeSheet, rerender } from './ui.js';

const KEY_STORE = 'claude-api-key'; // derselbe Schlüssel wie in photo.js
const MODEL = 'claude-opus-5-5';
const DAY = 86400000;

export const REGIONS = [
  { key: 'beine', label: 'Beine' },
  { key: 'oberkoerper', label: 'Oberkörper' },
  { key: 'rumpf', label: 'Rumpf' },
  { key: 'ausdauer', label: 'Ausdauer' },
];
const LOAD = ['–', 'etwas', 'deutlich', 'stark'];
const INTENSITY = { leicht: 'leicht', mittel: 'mittel', hart: 'hart' };

const SCHEMA = {
  type: 'object',
  properties: {
    aktivitaeten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          datum: { type: 'string' },
          minuten: { type: 'number' },
          intensitaet: { type: 'string', enum: ['leicht', 'mittel', 'hart'] },
          kcal: { type: 'number' },
          belastung: {
            type: 'object',
            properties: { beine: { type: 'integer' }, oberkoerper: { type: 'integer' }, rumpf: { type: 'integer' }, ausdauer: { type: 'integer' } },
            required: ['beine', 'oberkoerper', 'rumpf', 'ausdauer'],
            additionalProperties: false,
          },
          tipp: { type: 'string' },
        },
        required: ['name', 'emoji', 'datum', 'minuten', 'intensitaet', 'kcal', 'belastung', 'tipp'],
        additionalProperties: false,
      },
    },
  },
  required: ['aktivitaeten'],
  additionalProperties: false,
};

// Die App liefert eine kurze Beschreibung des Trainingsplans (siehe app.js)
let planContext = () => '';
export function configureActivity({ context }) {
  planContext = context;
}

let pending = []; // von Claude erkannte, noch nicht gespeicherte Einträge
let lastText = '';
let lastDate = ''; // vorgewählter Tag (JJJJ-MM-TT), leer = heute

function apiKey() {
  try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
}

/* ---------- Daten ---------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

export function isoDay(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function activities() {
  if (!Array.isArray(state.activities)) state.activities = [];
  return state.activities;
}

export function activitiesOn(date) {
  const iso = isoDay(date);
  return activities().filter((a) => a.date === iso);
}

export function activitiesBetween(from, to) {
  const a = isoDay(from);
  const b = isoDay(to);
  return activities().filter((x) => x.date >= a && x.date < b);
}

export function activityKcal(date) {
  return activitiesOn(date).reduce((s, a) => s + (a.kcal || 0), 0);
}

// Muskuläre Belastung (Ausdauer zählt hier nicht, die stört das Krafttraining kaum)
function muscleLoad(a) {
  return Math.max(0, ...['beine', 'oberkoerper', 'rumpf'].map((k) => a.load?.[k] || 0));
}

function sorted(list) {
  return [...list].sort((x, y) => (x.date === y.date ? x.added - y.added : x.date < y.date ? -1 : 1));
}

/* ---------- Anzeige ---------- */

function loadText(a) {
  const parts = REGIONS.filter((r) => (a.load?.[r.key] || 0) > 0).map((r) => `${r.label} ${LOAD[a.load[r.key]]}`);
  return parts.join(' · ');
}

function summary(a) {
  return [a.minutes ? `${n0(a.minutes)} Min` : '', INTENSITY[a.intensity] || '', a.kcal ? `ca. ${n0(a.kcal)} kcal` : ''].filter(Boolean).join(' · ');
}

export function activityRow(a, withDate = true) {
  return `<button class="row" data-action="act-edit" data-id="${a.id}"><span class="icon">${esc(a.emoji || '🏃')}</span>
    <div class="grow"><div>${esc(a.name)}</div><div class="small muted">${withDate ? `${fmtDate(parseDay(a.date))} · ` : ''}${summary(a)}</div></div><span class="chev">›</span></button>`;
}

export function activityList(n = 10) {
  return sorted(activities()).slice(-n).reverse().map((a) => activityRow(a)).join('');
}

export function activityButton(label = '🏃 Anderes Training eintragen', date = '') {
  return `<button class="btn secondary block" data-action="act-start" ${date ? `data-date="${date}"` : ''}>${label}</button>`;
}

export function calendarMark(date) {
  const list = activitiesOn(date);
  return list.length ? `<span class="act-mark">${esc(list[0].emoji || '🏃')}</span>` : '';
}

// Hinweis von Claude zum nächsten Training, wenn heute oder gestern etwas Anstrengendes dazukam
// und seitdem noch nicht trainiert wurde
export function activityHint(lastWorkoutAt = 0) {
  const yesterday = isoDay(Date.now() - DAY);
  const score = (x) => muscleLoad(x) * 2 + (x.intensity === 'hart' ? 1 : 0);
  const a = activities()
    .filter((x) => x.date >= yesterday && x.tip && !x.tipSeen && x.added > lastWorkoutAt && (muscleLoad(x) >= 2 || x.intensity === 'hart'))
    .sort((x, y) => score(y) - score(x))[0];
  if (!a) return '';
  const when = a.date === isoDay() ? 'Heute' : 'Gestern';
  return `
    <div class="card flex" style="align-items:flex-start">
      <span style="font-size:26px">${esc(a.emoji || '🏃')}</span>
      <div class="grow"><b>${when}: ${esc(a.name)}</b><div class="small muted">${loadText(a)}</div>
      <p class="small" style="margin:6px 0 0">${esc(a.tip)}</p></div>
      <button class="btn ghost small" data-action="act-hint-ok" data-id="${a.id}" aria-label="Hinweis ausblenden">✕</button>
    </div>`;
}

// Zusatzverbrauch heute für die Ernährungskarte
export function kcalNote(date = new Date()) {
  const list = activitiesOn(date).filter((a) => a.kcal);
  if (!list.length) return '';
  const total = list.reduce((s, a) => s + a.kcal, 0);
  return `<div class="small muted" style="margin-top:6px">${list.map((a) => esc(a.emoji || '🏃')).join(' ')} Durch ${esc(list.map((a) => a.name).join(' und '))} ${isoDay(date) === isoDay() ? 'heute' : 'an diesem Tag'} ca. ${n0(total)} kcal mehr verbraucht. Das Ziel ist entsprechend höher.</div>`;
}

/* ---------- Anfrage an Claude ---------- */

function dayLabel(iso) {
  return parseDay(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function promptText(text, day = isoDay()) {
  const today = new Date();
  const p = state.profile;
  return `Ich nutze eine Trainings-App mit festem Plan. Ich beschreibe dir, was ich zusätzlich an Sport oder Bewegung gemacht habe. Mach daraus Einträge für die App.

Heute ist ${today.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${isoDay(today)}).
Über mich: ${p.sex === 'f' ? 'weiblich' : 'männlich'}, ${p.age} Jahre, ${p.weight} kg.
Mein Plan: ${planContext()}

Meine Beschreibung: „${text}“

Antworte nur mit diesem JSON, ohne weiteren Text:
{"aktivitaeten": [{"name": "kurzer Name auf Deutsch, z. B. Fußball", "emoji": "⚽", "datum": "JJJJ-MM-TT", "minuten": 0, "intensitaet": "leicht | mittel | hart", "kcal": 0, "belastung": {"beine": 0, "oberkoerper": 0, "rumpf": 0, "ausdauer": 0}, "tipp": "1 bis 2 Sätze"}]}

Regeln:
- Eine Aktivität pro Eintrag. Steht kein Tag dabei, war es am ${day === isoDay() ? 'heute' : `${dayLabel(day)} (${day})`}. Ein Tag in der Beschreibung (z. B. „gestern“) gilt vorrangig.
- kcal: zusätzlich verbrauchte Kalorien über dem Ruheumsatz, realistisch für mich geschätzt.
- belastung je Bereich: 0 = gar nicht, 1 = etwas, 2 = deutlich, 3 = stark.
- tipp: was das konkret für mein nächstes Training im Plan bedeutet (z. B. normal trainieren, Beine etwas leichter, einen Tag Pause). Kurz und auf Deutsch, per Du.`;
}

function error(msg) {
  const el = document.getElementById('act-error');
  if (el) el.textContent = msg;
}

function start(text = '', date = '') {
  lastDate = clampDay(date || isoDay());
  const hasKey = !!apiKey();
  openSheet(`
    <h3>🏃 Anderes Training</h3>
    <p class="small muted">Beschreib einfach, was du gemacht hast, zum Beispiel „Gestern 90 Minuten Fußball, heute 30 Minuten locker joggen“. Claude macht daraus Einträge für Verlauf und Kalender und sagt dir, was das für dein nächstes Training heißt.</p>
    <div class="list">
      <label class="field"><span>Wann?</span><input id="act-date" type="date" max="${isoDay()}" value="${lastDate}"></label>
      <label class="field"><span>Was hast du gemacht?</span><textarea id="act-text" rows="3" placeholder="z. B. 2 Stunden Bouldern, war ziemlich anstrengend">${esc(text)}</textarea></label>
    </div>
    <p class="small warn" id="act-error"></p>
    ${hasKey ? `
      <button class="btn block" data-action="act-ask">Mit Claude auswerten</button>
    ` : `
      <button class="btn block" data-action="act-share">1. An Claude schicken</button>
      <div class="list" style="margin-top:10px">
        <label class="field"><span>2. Antwort von Claude hier einfügen</span><textarea id="act-answer" rows="3" placeholder='{"aktivitaeten": …}'></textarea></label>
      </div>
      <button class="btn secondary block" data-action="act-paste">Übernehmen</button>
    `}
    <button class="btn ghost block" data-action="act-manual" style="margin-top:8px">Selbst eintragen</button>
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>`);
}

function currentText() {
  const d = document.getElementById('act-date')?.value;
  if (d) lastDate = clampDay(d);
  const t = document.getElementById('act-text')?.value.trim() || '';
  if (t) lastText = t;
  return t;
}

async function share() {
  const text = currentText();
  if (!text) return error('Beschreib zuerst, was du gemacht hast.');
  error('');
  const prompt = promptText(text, lastDate);
  try { await navigator.clipboard.writeText(prompt); } catch { /* nicht schlimm */ }
  if (navigator.share) {
    try {
      await navigator.share({ text: prompt });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  error('Die Anfrage ist kopiert. Öffne die Claude-App, füge den Text ein und schicke ihn ab.');
}

async function ask(btn) {
  const text = currentText();
  if (!text) return error('Beschreib zuerst, was du gemacht hast.');
  error('');
  btn.disabled = true;
  btn.textContent = 'Claude wertet aus …';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: promptText(text, lastDate) }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Error('Der API-Schlüssel stimmt nicht.');
      if (res.status === 400 && /credit/i.test(body.error?.message || '')) throw new Error('Kein Guthaben mehr in der Anthropic Console.');
      throw new Error(body.error?.message || `Fehler ${res.status}`);
    }
    if (body.stop_reason === 'refusal') throw new Error('Claude konnte das nicht auswerten.');
    const answer = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    review(parseAnswer(answer));
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Mit Claude auswerten';
    error(e.message === 'Failed to fetch' ? 'Keine Verbindung. Bist du online?' : e.message);
  }
}

function clampDay(iso) {
  const today = isoDay();
  const oldest = isoDay(Date.now() - 30 * DAY);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) || iso > today || iso < oldest) return today;
  return iso;
}

// Liest das JSON aus der Antwort, auch wenn Claude etwas Text drumherum schreibt
export function parseAnswer(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('In der Antwort steht kein Eintrag. Bitte die ganze Antwort von Claude einfügen.');
  let j;
  try {
    j = JSON.parse(match[0].replace(/[“”„]/g, '"'));
  } catch {
    throw new Error('Die Antwort ließ sich nicht lesen. Bitte die ganze Antwort von Claude einfügen.');
  }
  const list = Array.isArray(j.aktivitaeten) ? j.aktivitaeten : Array.isArray(j) ? j : [j];
  const n = (v) => Math.max(0, Math.round(parseFloat(String(v ?? 0).replace(',', '.')) || 0));
  const out = list.filter((a) => a && a.name).map((a) => {
    const load = {};
    for (const r of REGIONS) load[r.key] = Math.min(3, n(a.belastung?.[r.key]));
    return {
      name: String(a.name).slice(0, 60),
      emoji: Array.from(String(a.emoji || '🏃')).slice(0, 6).join(''),
      date: clampDay(a.datum),
      minutes: n(a.minuten),
      intensity: INTENSITY[a.intensitaet] ? a.intensitaet : 'mittel',
      kcal: n(a.kcal),
      load,
      tip: String(a.tipp || '').slice(0, 400),
    };
  });
  if (!out.length) throw new Error('In der Antwort steht kein Eintrag. Bitte die ganze Antwort von Claude einfügen.');
  return out;
}

/* ---------- Prüfen und speichern ---------- */

function fields(a, i) {
  const loads = REGIONS.map((r) => `
    <label class="field"><span>${r.label}</span><select name="load-${r.key}-${i}">${LOAD.map((l, v) => `<option value="${v}" ${v === (a.load?.[r.key] || 0) ? 'selected' : ''}>${v ? l : 'gar nicht'}</option>`).join('')}</select></label>`).join('');
  return `
    <div class="list">
      <label class="field"><span>Was</span><input name="name-${i}" autocomplete="off" value="${esc(a.name)}" placeholder="z. B. Fußball"></label>
      <label class="field"><span>Tag</span><input name="date-${i}" type="date" max="${isoDay()}" value="${a.date}"></label>
      <label class="field"><span>Dauer (Min)</span><input name="minutes-${i}" type="text" inputmode="numeric" value="${a.minutes || ''}"></label>
      <label class="field"><span>Intensität</span><select name="intensity-${i}">${Object.keys(INTENSITY).map((k) => `<option ${k === a.intensity ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="field"><span>Mehrverbrauch (kcal)</span><input name="kcal-${i}" type="text" inputmode="numeric" value="${a.kcal || ''}"></label>
    </div>
    <p class="small muted" style="margin:8px 4px 0">Belastung: ${loadText(a) || 'keine Angabe'}</p>
    <details class="card small" style="margin-top:6px"><summary>Belastung anpassen</summary><div class="list">${loads}</div></details>
    ${a.tip ? `<p class="small muted">Claude: ${esc(a.tip)}</p>` : ''}`;
}

function review(list, id = null) {
  pending = list;
  const title = id ? 'Eintrag bearbeiten' : list.length > 1 ? `${list.length} Einträge, passt das so?` : 'Passt das so?';
  openSheet(`
    <form data-form="activity" ${id ? `data-id="${id}"` : ''}>
      <h3>${title}</h3>
      ${list.map((a, i) => `${list.length > 1 ? `<h2>${esc(a.emoji)} ${esc(a.name)}</h2>` : ''}${fields(a, i)}`).join('')}
      <p class="small warn" id="act-error"></p>
      <button class="btn block" type="submit">Speichern</button>
      ${id ? `<button class="btn ghost block" type="button" data-action="act-delete" data-id="${id}" style="margin-top:8px">Eintrag löschen</button>` : ''}
      <button class="btn secondary block" type="button" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>
    </form>`);
}

export function submitActivity(form) {
  const f = form.elements;
  const num = (name) => Math.max(0, Math.round(parseFloat(String(f[name]?.value || '').replace(',', '.')) || 0));
  const items = pending.map((a, i) => {
    const load = {};
    for (const r of REGIONS) load[r.key] = num(`load-${r.key}-${i}`);
    return {
      ...a,
      name: f[`name-${i}`].value.trim(),
      date: clampDay(f[`date-${i}`].value),
      minutes: num(`minutes-${i}`),
      intensity: f[`intensity-${i}`].value,
      kcal: num(`kcal-${i}`),
      load,
    };
  });
  if (items.some((a) => !a.name)) return error('Bitte bei jedem Eintrag angeben, was du gemacht hast.');
  const list = activities();
  const id = form.dataset.id;
  if (id) {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = { ...list[i], ...items[0] };
  } else {
    const now = Date.now();
    items.forEach((a, i) => list.push({ ...a, id: `act${now.toString(36)}${i}`, added: now, text: lastText }));
  }
  // Ältere Einträge als ein Jahr aufräumen
  const limit = isoDay(Date.now() - 365 * DAY);
  state.activities = list.filter((a) => a.date >= limit);
  save();
  pending = [];
  closeSheet();
  rerender();
}

export const activityActions = {
  'act-start'(el) {
    start(el.dataset.date ? '' : lastText, el.dataset.date || '');
  },
  'act-share'() {
    share();
  },
  'act-ask'(el) {
    ask(el);
  },
  async 'act-paste'() {
    currentText();
    const box = document.getElementById('act-answer');
    if (!box.value.trim()) {
      try { box.value = await navigator.clipboard.readText(); } catch { /* Nutzer fügt selbst ein */ }
    }
    if (!box.value.trim()) return error('Bitte die Antwort von Claude einfügen.');
    try {
      review(parseAnswer(box.value));
    } catch (e) {
      error(e.message);
    }
  },
  'act-manual'() {
    currentText();
    review([{ name: '', emoji: '🏃', date: lastDate || isoDay(), minutes: 0, intensity: 'mittel', kcal: 0, load: {}, tip: '' }]);
  },
  'act-edit'(el) {
    const a = activities().find((x) => x.id === el.dataset.id);
    if (a) review([a], a.id);
  },
  'act-delete'(el) {
    const a = activities().find((x) => x.id === el.dataset.id);
    if (!a || !confirm(`„${a.name}“ löschen?`)) return;
    state.activities = activities().filter((x) => x.id !== a.id);
    save();
    closeSheet();
    rerender();
  },
  'act-hint-ok'(el) {
    const a = activities().find((x) => x.id === el.dataset.id);
    if (!a) return;
    a.tipSeen = true;
    save();
    rerender();
  },
};
