// Werte aus Apple Health (vom iPhone selbst oder von einer Apple Watch). Eine Web-App kann
// Health nicht selbst lesen, deshalb sammelt ein Kurzbefehl die Werte des Tages als Text.
// Zwei Wege in die App:
//  - automatisch: Ist der gemeinsame Speicher verbunden (sync.js), schickt der Kurzbefehl den
//    Text dorthin (households/<code>/inbox/<memberId>), z. B. jeden Abend per Automation.
//    Die App holt ihn beim nächsten Öffnen ab, trägt ihn ein und löscht ihn dort.
//  - von Hand: Die App startet den Kurzbefehl und fügt danach die Zwischenablage ein.
//
// Text vom Kurzbefehl (jede Zeile optional, Reihenfolge egal):
//   CALI-HEALTH
//   Datum: 23.10.2026
//   Aktivkalorien: 523,4
//   Schritte: 8.432
//   Trainingsminuten: 41
//   Ruhepuls: 58
//   HRV: 46
//   Workout: Laufen | 32 min | 287 kcal
import { state, save } from './store.js';
import { esc, n0, fmtDate, openSheet, closeSheet, rerender, lineChart, barChart } from './ui.js';
import { activities, isoDay, REGIONS } from './activity.js';
import { isLinked, inboxUrl, inboxEntries, fetchInbox, clearInbox } from './sync.js';

const DAY = 86400000;
const KEEP_DAYS = 400;
const DEFAULT_NAME = 'Cali Health';

const FIELDS = [
  { key: 'steps', label: 'Schritte', short: 'Schritte', unit: '', min: 0, max: 100000, re: /^(schritte|steps?)/ },
  { key: 'active', label: 'Aktivkalorien', short: 'kcal aktiv', unit: 'kcal', min: 0, max: 6000, re: /^(aktiv|active)/ },
  { key: 'exercise', label: 'Trainingsminuten', short: 'Min Training', unit: 'Min', min: 0, max: 900, re: /^(trainingsmin|bewegungsmin|exercise|übungsmin)/ },
  { key: 'restHr', label: 'Ruhepuls', short: 'Ruhepuls', unit: 'bpm', min: 25, max: 140, re: /^(ruhepuls|ruheherz|resting)/ },
  { key: 'hrv', label: 'HRV', short: 'HRV (ms)', unit: 'ms', min: 3, max: 300, re: /^(hrv|herzfrequenzvar|heart rate var)/ },
];

// Sportarten aus Apple-Workouts (deutsch und englisch) → Eintrag für „Anderes Training“.
// gym = Kraft- bzw. Calisthenics-Training, das läuft schon über die App und wird nicht doppelt gezählt.
const SPORTS = [
  { re: /kraft|strength|gewicht|weight|core|calisthenics/i, name: 'Krafttraining', emoji: '💪', gym: true },
  { re: /lauf|run|jogg/i, name: 'Laufen', emoji: '🏃', load: { beine: 2, rumpf: 1, ausdauer: 3 } },
  { re: /wander|hik/i, name: 'Wandern', emoji: '🥾', load: { beine: 2, ausdauer: 2 } },
  { re: /geh|walk|spazier/i, name: 'Gehen', emoji: '🚶', load: { beine: 1, ausdauer: 1 } },
  { re: /rad|cycl|bik|spinning/i, name: 'Radfahren', emoji: '🚴', load: { beine: 2, ausdauer: 3 } },
  { re: /schwimm|swim/i, name: 'Schwimmen', emoji: '🏊', load: { oberkoerper: 2, rumpf: 1, ausdauer: 3 } },
  { re: /fu(ß|ss)ball|soccer/i, name: 'Fußball', emoji: '⚽', load: { beine: 3, rumpf: 1, ausdauer: 3 } },
  { re: /yoga|pilates|mobil|flexib|dehn|cooldown|abkühl/i, name: 'Yoga', emoji: '🧘', load: { rumpf: 1 } },
  { re: /tanz|dance|zumba/i, name: 'Tanzen', emoji: '🕺', load: { beine: 1, ausdauer: 2 } },
  { re: /hiit|intervall|functional|cross|box|kick|bootcamp/i, name: 'HIIT', emoji: '🔥', load: { beine: 2, oberkoerper: 1, rumpf: 2, ausdauer: 3 } },
  { re: /ellip|crosstrainer|stepper|stair|treppe|ruder|row/i, name: 'Cardio', emoji: '🚣', load: { beine: 1, oberkoerper: 1, ausdauer: 2 } },
  { re: /klett|boulder|climb/i, name: 'Bouldern', emoji: '🧗', load: { oberkoerper: 3, rumpf: 2 } },
  { re: /tennis|squash|badminton|padel|volley|basket|hand/i, name: 'Ballsport', emoji: '🎾', load: { beine: 2, oberkoerper: 1, ausdauer: 2 } },
];

const MONTHS = ['jan', 'feb', 'm', 'apr', 'ma', 'jun', 'jul', 'aug', 'sep', 'o', 'nov', 'd'];

let pending = null; // gelesene, noch nicht gespeicherte Werte
let awaiting = 0; // Zeitpunkt, zu dem der Kurzbefehl gestartet wurde
const handled = new Set(); // schon übernommene Einträge aus dem Speicher

function health() {
  if (!state.health || typeof state.health !== 'object') state.health = {};
  if (!state.health.days) state.health.days = {};
  return state.health;
}

export function shortcutName() {
  return health().shortcut || DEFAULT_NAME;
}

export function healthOn(date = new Date()) {
  return health().days[isoDay(date)] || null;
}

function hasAny() {
  return Object.keys(health().days).length > 0;
}

/* ---------- Text vom Kurzbefehl lesen ---------- */

// Erste Zahl im Text, deutsch oder englisch geschrieben („8.432“, „523,4“, „1,234.5“)
function firstNum(s) {
  const m = String(s).replace(/[  ]/g, ' ').match(/-?\d[\d.,' ]*/);
  if (!m) return null;
  let t = m[0].trim().replace(/[' ]/g, '');
  if (/\d,\d{3}\./.test(t)) t = t.replace(/,/g, ''); // 1,234.5
  else if (/\d\.\d{3},/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,5
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 8.432
  else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, ''); // 8,432
  else t = t.replace(',', '.');
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

// Dauer in Minuten aus „0:32:10“, „32:10“, „1 Std. 5 Min.“, „32 min“, „1925“ (Sekunden)
function parseMinutes(s) {
  const t = String(s).toLowerCase();
  let m = t.match(/(\d+):(\d{2}):(\d{2})/);
  if (m) return +m[1] * 60 + +m[2] + +m[3] / 60;
  m = t.match(/(\d+):(\d{2})/);
  if (m) return +m[1] < 5 ? +m[1] * 60 + +m[2] : +m[1] + +m[2] / 60;
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(h|std|stunde|hr|hour)/);
  const mi = t.match(/(\d+(?:[.,]\d+)?)\s*(min|m\b)/);
  const se = t.match(/(\d+)\s*(s\b|sek|sec)/);
  if (h || mi || se) {
    const f = (x) => (x ? parseFloat(x[1].replace(',', '.')) : 0);
    return f(h) * 60 + f(mi) + f(se) / 60;
  }
  const v = firstNum(t);
  if (v == null) return 0;
  return v > 300 ? v / 60 : v;
}

function parseDate(s) {
  const t = String(s).toLowerCase().trim();
  const now = new Date();
  if (/gestern|yesterday/.test(t)) return isoDay(Date.now() - DAY);
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoDay(new Date(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return isoDay(new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
  m = t.match(/(\d{1,2})\.?\s*([a-zä]+)\.?\s*(\d{4})/) || t.match(/([a-zä]+)\.?\s*(\d{1,2}),?\s*(\d{4})/);
  if (m) {
    const [day, word] = /\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    const w = word.replace('ä', 'a');
    let month = -1;
    if (w.startsWith('mar') || w.startsWith('mär')) month = 2;
    else if (w.startsWith('may') || w.startsWith('mai')) month = 4;
    else if (w.startsWith('oct') || w.startsWith('okt')) month = 9;
    else if (w.startsWith('dec') || w.startsWith('dez')) month = 11;
    else month = MONTHS.findIndex((x) => x.length > 2 && w.startsWith(x));
    if (month >= 0) return isoDay(new Date(+m[3], month, day));
  }
  return isoDay(now);
}

function sportOf(text) {
  return SPORTS.find((s) => s.re.test(text)) || null;
}

function parseWorkout(value) {
  const parts = String(value).split('|').map((x) => x.trim());
  const sport = sportOf(parts[0]) || sportOf(value);
  const minutes = Math.round(parts[1] != null ? parseMinutes(parts[1]) : 0);
  const kcal = Math.round(parts[2] != null ? firstNum(parts[2]) || 0 : 0);
  const raw = parts[0].replace(/^hk\w*type\w*/i, '').trim();
  return {
    name: sport ? sport.name : (raw && !/^\d/.test(raw) ? raw.slice(0, 40) : 'Training'),
    emoji: sport ? sport.emoji : '🏅',
    gym: !!sport?.gym,
    minutes: Math.max(0, Math.min(600, minutes)),
    kcal: Math.max(0, Math.min(4000, kcal)),
  };
}

export function parseHealth(text) {
  const out = { date: isoDay(), workouts: [] };
  let found = 0;
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();
    if (/^(datum|date|tag)$/.test(key)) { out.date = parseDate(value); out.dated = true; continue; }
    if (/^(workout|training)$/.test(key)) {
      if (value) { out.workouts.push(parseWorkout(value)); found++; }
      continue;
    }
    const f = FIELDS.find((x) => x.re.test(key));
    if (!f || !value) continue;
    const v = firstNum(value);
    if (v == null || v < f.min || v > f.max) continue;
    out[f.key] = Math.round(v);
    found++;
  }
  if (!found) {
    throw new Error(/(CALI|GYM)-HEALTH/i.test(text)
      ? 'Der Kurzbefehl hat für heute keine Werte gefunden. Hat Kurzbefehle Zugriff auf Health? (Health-App → Profil → Apps → Kurzbefehle)'
      : 'In der Zwischenablage stehen keine Werte vom Kurzbefehl. Lass ihn zuerst laufen.');
  }
  return out;
}

/* ---------- Kurzbefehl starten und Ergebnis einfügen ---------- */

function error(msg) {
  const el = document.getElementById('health-error');
  if (el) el.textContent = msg;
}

function runShortcut() {
  awaiting = Date.now();
  location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName())}`;
}

// Beim Öffnen: Werte aus dem Speicher abholen. Zurück aus der Kurzbefehle-App: abholen und,
// falls dort nichts angekommen ist, das Einfügen anbieten.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  const recent = awaiting && Date.now() - awaiting < 10 * 60000;
  awaiting = 0;
  let got = 0;
  if (isLinked()) {
    // Der Kurzbefehl braucht nach dem Zurückwechseln evtl. noch einen Moment
    for (let i = 0; i < (recent ? 3 : 1) && !got; i++) {
      if (i) await new Promise((ok) => { setTimeout(ok, 1500); });
      got = await pullInbox();
    }
  }
  if (recent && !got) setTimeout(pasteSheet, 50);
});

function pasteSheet(msg = '') {
  openSheet(`
    <h3>❤️ Werte einfügen</h3>
    <p class="small muted">Der Kurzbefehl hat die Werte von Apple Health kopiert. Tippe auf <b>Einfügen</b> und bestätige mit <b>Einfügen</b>, falls das iPhone fragt.</p>
    <p class="small warn" id="health-error">${esc(msg)}</p>
    <button class="btn block" data-action="health-paste">Einfügen</button>
    <details class="card small" style="margin-top:10px"><summary>Klappt nicht? Text selbst einfügen</summary>
      <textarea id="health-text" rows="5" placeholder="CALI-HEALTH&#10;Schritte: …"></textarea>
      <button class="btn secondary block" data-action="health-paste-text" style="margin-top:8px">Übernehmen</button>
    </details>
    <button class="btn secondary block" data-action="health-run" style="margin-top:8px">Kurzbefehl nochmal starten</button>
    <button class="btn ghost block" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>`);
}

/* ---------- Prüfen und speichern ---------- */

function importKey(date, w) {
  return `${date}|${w.name}|${w.minutes}`;
}

function alreadyImported(key) {
  return activities().some((a) => a.watch === key);
}

function tiles(d) {
  const shown = FIELDS.filter((f) => d[f.key] != null);
  if (!shown.length) return '';
  return `<div class="stats watch-stats">${shown.map((f) => `
    <div class="card"><div class="big">${n0(d[f.key])}</div><div class="small muted">${f.short}</div></div>`).join('')}</div>`;
}

function review(data) {
  pending = data;
  const rows = data.workouts.map((w, i) => {
    const key = importKey(data.date, w);
    const done = alreadyImported(key);
    const info = [w.minutes ? `${w.minutes} Min` : '', w.kcal ? `${n0(w.kcal)} kcal` : ''].filter(Boolean).join(' · ');
    const note = w.gym ? 'Krafttraining zählt schon über die App' : done ? 'schon eingetragen' : 'als „Anderes Training“ eintragen';
    return `<label class="check-row"><span class="icon">${esc(w.emoji)}</span><span class="grow">${esc(w.name)}${info ? ` · ${info}` : ''}
      <div class="small muted">${note}</div></span>
      ${w.gym || done ? '' : `<input type="checkbox" class="switch" name="w-${i}" checked>`}</label>`;
  }).join('');
  openSheet(`
    <form data-form="health">
      <h3>❤️ Werte von Apple Health</h3>
      <div class="list"><label class="field"><span>Tag</span><input name="date" type="date" max="${isoDay()}" value="${data.date}"></label></div>
      ${tiles(data)}
      ${rows ? `<h2>Workouts</h2><div class="list">${rows}</div>
        <p class="small muted">Eingetragene Workouts erscheinen im Kalender und erhöhen das Kalorienziel des Tages um die verbrauchten kcal.</p>` : ''}
      <p class="small warn" id="health-error"></p>
      <button class="btn block" type="submit">Speichern</button>
      <button class="btn secondary block" type="button" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>
    </form>`);
}

function intensityOf(w) {
  if (!w.minutes || !w.kcal) return 'mittel';
  const perMin = w.kcal / w.minutes;
  return perMin < 5 ? 'leicht' : perMin < 10 ? 'mittel' : 'hart';
}

// Werte eines Tages speichern; take(i) sagt, ob Workout i als „Anderes Training“ eingetragen wird
function storeDay(data, date, take) {
  const h = health();
  const prev = h.days[date] || {};
  const day = { ...prev, at: Date.now(), workouts: data.workouts.map(({ name, emoji, gym, minutes, kcal }) => ({ name, emoji, gym, minutes, kcal })) };
  for (const f of FIELDS) if (data[f.key] != null) day[f.key] = data[f.key];
  h.days[date] = day;

  // Workouts als „Anderes Training“ übernehmen
  const now = Date.now();
  data.workouts.forEach((w, i) => {
    const key = importKey(date, w);
    if (w.gym || !take(i) || alreadyImported(key)) return;
    const sport = SPORTS.find((s) => s.name === w.name);
    const load = {};
    for (const r of REGIONS) load[r.key] = sport?.load?.[r.key] || 0;
    activities().push({
      id: `act${now.toString(36)}w${i}`, added: now, watch: key, text: 'Apple Health',
      name: w.name, emoji: w.emoji, date, minutes: w.minutes, intensity: intensityOf(w), kcal: w.kcal, load, tip: '',
    });
  });

  const limit = isoDay(Date.now() - KEEP_DAYS * DAY);
  for (const k of Object.keys(h.days)) if (k < limit) delete h.days[k];
  save();
}

export function submitHealth(form) {
  if (!pending) return closeSheet();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(form.elements.date.value) && form.elements.date.value <= isoDay() ? form.elements.date.value : pending.date;
  storeDay(pending, date, (i) => form.elements[`w-${i}`]?.checked);
  pending = null;
  closeSheet();
  rerender();
}

/* ---------- Automatisch aus dem gemeinsamen Speicher ---------- */

// Firebase-Schlüssel von POST enthalten den Zeitpunkt (erste 8 Zeichen, Millisekunden)
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function pushTime(id) {
  if (!/^[-\w]{20}$/.test(id)) return null;
  let t = 0;
  for (const c of id.slice(0, 8)) t = t * 64 + PUSH_CHARS.indexOf(c);
  return t > 1.5e12 && t < Date.now() + DAY ? t : null;
}

// Einträge übernehmen und dort löschen. Gibt die Zahl der übernommenen Tage zurück.
function takeEntries(entries) {
  let n = 0;
  for (const [id, entry] of entries.sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (handled.has(id)) continue;
    handled.add(id);
    try {
      const data = parseHealth(typeof entry === 'string' ? entry : entry?.text || '');
      // Ohne Datumszeile zählt der Tag, an dem der Kurzbefehl gesendet hat
      const sent = pushTime(id);
      if (!data.dated && sent) data.date = isoDay(sent);
      if (data.date <= isoDay()) {
        storeDay(data, data.date, () => true);
        n++;
      }
    } catch { /* leer oder unlesbar: trotzdem entfernen */ }
    clearInbox(id);
  }
  if (n) health().lastAuto = Date.now();
  return n;
}

// Aus dem Live-Abbild (app.js ruft das bei jeder Änderung im Speicher auf)
export function importInbox() {
  const n = takeEntries(inboxEntries());
  if (n) save();
  return n;
}

async function pullInbox() {
  try {
    const n = takeEntries(await fetchInbox());
    if (n) rerender();
    return n;
  } catch {
    return 0;
  }
}

/* ---------- Tagesform aus Ruhepuls und HRV ---------- */

function baseline(key, date) {
  const iso = isoDay(date);
  const from = isoDay(new Date(date).getTime() - 28 * DAY);
  const vals = Object.entries(health().days).filter(([k, d]) => k < iso && k >= from && d[key] != null).map(([, d]) => d[key]);
  return vals.length >= 5 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function readiness(d, date) {
  const notes = [];
  const hr = baseline('restHr', date);
  const hrv = baseline('hrv', date);
  if (d.restHr != null && hr != null && d.restHr >= hr + 5) notes.push(`Ruhepuls ${n0(d.restHr - hr)} über deinem Schnitt`);
  if (d.hrv != null && hrv != null && d.hrv <= hrv * 0.8) notes.push('HRV deutlich unter deinem Schnitt');
  if (!notes.length) return '';
  return `<div class="small sore-note" style="margin-top:8px">💤 <b>${notes.join(', ')}.</b> Dein Körper ist heute etwas angeschlagen (wenig Schlaf, Stress oder ein Infekt im Anmarsch). Trainier ruhig, aber eher leichter und ohne neue Stufe oder Rekordversuche. Fühlst du dich krank, lieber Pause.</div>`;
}

/* ---------- Anzeige ---------- */

// Karte auf der Startseite (heute) und in der Tagesansicht (vergangene Tage)
export function healthCard(date = new Date()) {
  const today = isoDay(date) === isoDay();
  const d = healthOn(date);
  if (!d) {
    if (!today) return '';
    return hasAny()
      ? '<button class="btn secondary block" data-action="health-run">❤️ Health-Werte holen</button>'
      : '<button class="btn secondary block" data-action="health-setup">❤️ Apple Health verbinden</button>';
  }
  const w = (d.workouts || []).map((x) => `${esc(x.emoji)} ${esc(x.name)}${x.minutes ? ` ${x.minutes} Min` : ''}${x.kcal ? ` · ${n0(x.kcal)} kcal` : ''}`).join('<br>');
  const at = d.at ? new Date(d.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  return `
    <div class="card">
      <div class="flex between"><b>❤️ Apple Health</b>${today ? `<button class="btn ghost small" data-action="health-run">Aktualisieren</button>` : ''}</div>
      ${tiles(d)}
      ${w ? `<div class="small" style="margin-top:8px">${w}</div>` : ''}
      ${today && at ? `<div class="small muted" style="margin-top:6px">Stand ${at} Uhr</div>` : ''}
      ${readiness(d, date)}
    </div>`;
}

// Abschnitt in „Fortschritt“
export function healthProgress() {
  const days = Object.entries(health().days).sort(([a], [b]) => (a < b ? -1 : 1));
  if (!days.length) {
    return `<h2>Apple Health</h2>
      <p class="small muted">Schritte, Aktivkalorien und Workouts wie Joggen aus Apple Health übernehmen, vom iPhone oder einer Apple Watch. Einmal einen Kurzbefehl anlegen, danach läuft es jeden Tag von selbst.</p>
      <button class="btn secondary block" data-action="health-setup">❤️ Apple Health verbinden</button>`;
  }
  const hr = days.filter(([, d]) => d.restHr != null).slice(-30);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(Date.now() - i * DAY);
    week.push({ label: fmtDate(dt, { weekday: 'short' }), d: healthOn(dt) });
  }
  return `<h2>Apple Health</h2>
    <div class="card"><b>Schritte (letzte 7 Tage)</b>
      ${barChart(week.map((x) => (x.d?.steps != null ? Math.round(x.d.steps / 100) / 10 : 0)), week.map((x) => x.label))}
      <div class="small muted center">in Tausend</div></div>
    ${hr.length >= 2 ? `<div class="card"><b>Ruhepuls</b>${lineChart(hr.map(([, d]) => d.restHr))}
      <div class="small muted">Sinkt er über Wochen, wird deine Ausdauer besser. Ein plötzlicher Anstieg heißt oft: zu wenig Schlaf, Stress oder eine Erkältung.</div></div>` : ''}
    <button class="btn secondary block" data-action="health-run">❤️ Werte von heute holen</button>`;
}

// Abschnitt im Profil
export function healthSettings() {
  return `
    <div class="list">
      <button class="row" data-action="health-setup"><span class="icon">❤️</span><span class="grow">Kurzbefehl einrichten<div class="small muted">Name: ${esc(shortcutName())} · ${autoStatus()}</div></span><span class="chev">›</span></button>
      ${hasAny() ? '<button class="row" data-action="health-clear" style="color:#dc2626"><span class="grow">Health-Werte löschen</span></button>' : ''}
    </div>`;
}

function autoStatus() {
  if (!isLinked()) return 'automatisch erst mit „Gemeinsam planen“';
  const last = health().lastAuto;
  return last ? `zuletzt automatisch am ${fmtDate(new Date(last), { day: 'numeric', month: 'numeric' })}` : 'automatisch möglich';
}

/* ---------- Anleitung ---------- */

// Nachbau einer Kurzbefehle-Aktion: Name und die Einstellungen, die man antippen muss
const tok = (t) => `<span class="sc-tok">${t}</span>`;
const par = (t) => `<span class="sc-par">${t}</span>`;

function action(icon, color, name, body, how) {
  return `<li><div class="sc-action"><div class="sc-head"><span class="sc-icon" style="background:${color}">${icon}</span><b>${name}</b></div>
    ${body ? `<div class="sc-body">${body}</div>` : ''}</div>
    ${how ? `<div class="small muted sc-how">${how}</div>` : ''}</li>`;
}

const HOW_FIND = 'Unten ins Suchfeld <b>Health</b> tippen → <b>Health-Beispiele suchen</b>. Dann auf das blaue <b>Typ</b> tippen und den Typ wählen. <b>Filter hinzufügen</b> → <b>Startdatum</b> → <b>ist heute</b>. Ganz unten bei <b>Gruppieren nach</b> → <b>Tag</b>.';
const HOW_VAR = 'Variablen einsetzen: in den Text tippen, über der Tastatur auf <b>Variable auswählen</b> und dann auf die blaue Blase der passenden Aktion weiter oben tippen.';

function setupSheet() {
  const url = inboxUrl();
  const send = url
    ? action('🌐', '#0a84ff', 'Inhalte von URL abrufen',
      `${tok('URL')} = <span class="sc-url">${esc(url)}</span><br>Methode ${par('POST')} · Anfragetext ${par('JSON')}<br>Feld: Schlüssel ${par('text')} · Typ ${par('Text')} · Wert ${tok('Text')}`,
      `Suchfeld: <b>URL</b> → <b>Inhalte von URL abrufen</b>. Auf <b>URL</b> tippen und die Adresse einfügen:
       <button class="btn secondary small" type="button" data-action="health-copy-url" style="margin:6px 0">📋 Adresse kopieren</button><br>
       Dann auf den kleinen Pfeil <b>›</b> der Aktion tippen: <b>Methode</b> → <b>POST</b>, <b>Anfragetext</b> → <b>JSON</b>, <b>Neues Feld hinzufügen</b> → <b>Text</b>. Als Schlüssel <b>text</b> schreiben, als Wert die Variable <b>Text</b> aus Schritt 4 einsetzen.`)
    : action('📋', '#8e8e93', 'In Zwischenablage kopieren', `${tok('Text')}`, 'Suchfeld: <b>Zwischenablage</b> → <b>In Zwischenablage kopieren</b>.');

  openSheet(`
    <h3>❤️ Apple Health verbinden</h3>
    <p class="small muted">Dein iPhone zählt Schritte und Kalorien auch ohne Uhr, Läufe landen ebenfalls in Health. Die App darf Health aber nicht selbst lesen. Dafür baust du einmal einen kleinen <b>Kurzbefehl</b> (ein Mini-Programm in der Kurzbefehle-App von Apple). Er liest die Werte und schickt sie an die App. Dauert ca. 10 Minuten.</p>
    ${url ? '<p class="small">✅ Gemeinsamer Speicher ist verbunden, die Werte können automatisch kommen.</p>'
    : '<p class="small sore-note card">⚠️ Für das <b>automatische</b> Übertragen muss die App unter <b>Profil → Gemeinsam planen</b> verbunden sein. Ohne geht es nur von Hand (Kurzbefehl starten, Werte einfügen).</p>'}

    <h2>Teil 1 · Kurzbefehl bauen</h2>
    <ol class="small guide sc-steps">
      <li>App <b>Kurzbefehle</b> öffnen (vorinstalliert, sonst gratis im App Store). Unten <b>Kurzbefehle</b>, oben rechts <b>+</b>. Oben auf den Titel tippen → <b>Umbenennen</b> → <b>${esc(shortcutName())}</b>.</li>
      ${action('❤️', '#ff375f', 'Health-Beispiele suchen', `Typ ${par('Schritte')} · Startdatum ${par('ist heute')} · Gruppieren nach ${par('Tag')}`, HOW_FIND)}
      ${action('❤️', '#ff375f', 'Health-Beispiele suchen', `Typ ${par('Aktive Energie')} · Startdatum ${par('ist heute')} · Gruppieren nach ${par('Tag')}`, 'Genauso wie eben, nur mit dem Typ <b>Aktive Energie</b>.')}
      ${action('📝', '#ffcc00', 'Text', `Schritte: ${tok('Health-Beispiele')}<br>Aktivkalorien: ${tok('Health-Beispiele')}`,
        `Suchfeld: <b>Text</b> → <b>Text</b>. Genau so hineinschreiben. Hinter „Schritte:“ kommt das Ergebnis aus Schritt 2, hinter „Aktivkalorien:“ das aus Schritt 3. ${HOW_VAR}`)}
      ${send}
      <li>Fertig gebaut: oben rechts <b>Fertig</b>. Dann den Kurzbefehl einmal antippen, damit er läuft. Beim ersten Mal fragt das iPhone, ob er Health lesen ${url ? 'und etwas senden ' : ''}darf: <b>Erlauben</b>.</li>
    </ol>
    ${url ? `<button class="btn secondary block" data-action="health-check">Angekommen? Jetzt prüfen</button>
    <p class="small" id="health-check-msg"></p>` : ''}

    <h2>Teil 2 · Jeden Abend automatisch</h2>
    ${url ? `<ol class="small guide sc-steps">
      <li>In Kurzbefehle unten auf <b>Automation</b> → <b>+</b> (bzw. <b>Neue Automation</b>).</li>
      <li><b>Tageszeit</b> wählen → <b>21:30</b> (oder wann du abends meist am Handy bist) → <b>Täglich</b>.</li>
      <li>Unten <b>Sofort ausführen</b> auswählen (sonst fragt das iPhone jedes Mal nach) → <b>Weiter</b>.</li>
      <li>Den Kurzbefehl <b>${esc(shortcutName())}</b> antippen. Fertig.</li>
    </ol>
    <p class="small muted">Ab jetzt landen die Werte jeden Abend im Speicher. Öffnest du die App, trägt sie alles selbst ein. Wichtig: Ist das iPhone um diese Uhrzeit gesperrt, lässt iOS keinen Zugriff auf Health zu. Nimm also eine Zeit, zu der du es meist in der Hand hast.</p>`
    : '<p class="small muted">Geht erst, wenn „Gemeinsam planen“ verbunden ist. Bis dahin: in der App auf <b>❤️ Health-Werte holen</b> tippen, der Kurzbefehl läuft, zurück in die App wechseln und <b>Einfügen</b> tippen.</p>'}

    <details class="card small"><summary><b>Extra: Joggen & andere Trainings mitschicken</b></summary>
      <p>Erst einrichten, wenn der Rest klappt. Diese Aktionen kommen <b>zwischen</b> Schritt 3 und den Text:</p>
      <ol class="guide sc-steps">
        ${action('❤️', '#ff375f', 'Health-Beispiele suchen', `Typ ${par('Trainings')} · Startdatum ${par('ist heute')}`, 'Wie oben, Typ <b>Trainings</b> (engl. Workouts). Hier <b>ohne</b> Gruppieren.')}
        ${action('🔁', '#8e8e93', 'Wiederholen mit jedem Objekt in', `${tok('Health-Beispiele')}`, 'Suchfeld: <b>Wiederholen</b> → <b>Wiederholen mit jedem</b>.')}
        ${action('📝', '#ffcc00', 'Text (innerhalb von Wiederholen)', `Workout: ${tok('Wiederholungsobjekt')} | ${tok('Dauer')} | ${tok('Wert')}`,
          'Die Text-Aktion in den Wiederholen-Block ziehen. Für „Dauer“ und „Wert“ jeweils <b>Wiederholungsobjekt</b> einsetzen, die Blase antippen und <b>Dauer</b> bzw. <b>Wert</b> auswählen.')}
      </ol>
      <p>Im großen Text (Schritt 4) dann eine neue Zeile mit der Variable ${tok('Wiederholungsergebnisse')} anhängen.</p>
    </details>

    <details class="card small"><summary><b>Klappt nicht?</b></summary>
      <ul class="guide">
        <li>Keine Werte: <b>Health-App → Profilbild oben rechts → Apps → Kurzbefehle</b> → alles einschalten.</li>
        <li>Kurzbefehl heißt anders: unten den Namen anpassen, sonst findet die App ihn beim Holen von Hand nicht.</li>
        <li>Schick mir einfach einen Screenshot von deinem Kurzbefehl, dann sage ich dir, was fehlt.</li>
      </ul>
    </details>

    <div class="list" style="margin-top:12px"><label class="field"><span>Name des Kurzbefehls</span><input id="health-name" value="${esc(shortcutName())}" autocomplete="off"></label></div>
    <button class="btn block" data-action="health-save-name">Speichern und Kurzbefehl starten</button>
    <button class="btn ghost block" data-action="close-sheet" style="margin-top:8px">Schließen</button>`);
}

async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

export const healthActions = {
  'health-setup'() {
    setupSheet();
  },
  'health-run'() {
    runShortcut();
  },
  'health-save-name'() {
    const name = document.getElementById('health-name')?.value.trim();
    health().shortcut = name && name !== DEFAULT_NAME ? name : undefined;
    save();
    runShortcut();
  },
  async 'health-copy-url'(el) {
    try {
      await navigator.clipboard.writeText(inboxUrl());
      el.textContent = 'Kopiert ✓';
    } catch {
      el.textContent = 'Bitte von Hand markieren';
    }
  },
  async 'health-check'(el) {
    const msg = document.getElementById('health-check-msg');
    el.disabled = true;
    let n = 0;
    try {
      n = takeEntries(await fetchInbox());
      if (n) save();
    } catch {
      n = -1;
    }
    el.disabled = false;
    if (msg) {
      msg.textContent = n > 0 ? `✅ Klappt! Werte für ${n === 1 ? 'einen Tag' : `${n} Tage`} übernommen.`
        : n < 0 ? 'Keine Verbindung zum Speicher. Internet an?'
          : health().lastAuto ? '✅ Hat schon geklappt, gerade liegt nichts Neues an.'
            : 'Noch nichts angekommen. Ist der Kurzbefehl einmal gelaufen? Sonst Schritt 5 nochmal prüfen.';
    }
  },
  'health-paste-sheet'() {
    pasteSheet();
  },
  async 'health-paste'() {
    const text = await readClipboard();
    if (!text) return error('Die Zwischenablage ist leer oder das Einfügen wurde nicht erlaubt. Du kannst den Text auch unten selbst einfügen.');
    try {
      review(parseHealth(text));
    } catch (e) {
      error(e.message);
    }
  },
  'health-paste-text'() {
    const text = document.getElementById('health-text')?.value || '';
    try {
      review(parseHealth(text));
    } catch (e) {
      error(e.message);
    }
  },
  'health-clear'() {
    if (!confirm('Alle Werte aus Apple Health löschen? Eingetragene Workouts bleiben im Verlauf.')) return;
    health().days = {};
    save();
    rerender();
  },
};
