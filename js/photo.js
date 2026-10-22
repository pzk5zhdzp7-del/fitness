// Auswärts gegessen: Essen fotografieren, Claude schätzt die Nährwerte, Eintrag für den Tag.
// Zwei Wege: mit eigenem API-Schlüssel direkt aus der App, sonst über die Claude-App (Teilen/Kopieren).
import { state, save } from './store.js';
import { dayMeals, dayMacros, recipeMacros, ensurePlan } from './nutrition.js';
import { getRecipe } from './data/food.js';
import { esc, n0, openSheet, closeSheet, rerender, WEEKDAYS, WEEK_ORDER } from './ui.js';

const KEY_STORE = 'claude-api-key'; // bewusst getrennt vom Backup, damit der Schlüssel nicht exportiert wird
const MODEL = 'claude-opus-5-5';

const PROMPT = `Schätze die Nährwerte der Mahlzeit auf dem Foto, so wie sie auf dem Teller liegt (eine Person).
Achte auf Portionsgröße, Öl, Soßen und Beilagen. Lieber realistisch als zu niedrig schätzen.
Antworte nur mit diesem JSON, ohne weiteren Text:
{"gericht": "kurzer Name auf Deutsch", "kcal": 0, "eiweiss": 0, "kohlenhydrate": 0, "fett": 0, "hinweis": "kurz, was du angenommen hast"}`;

const SCHEMA = {
  type: 'object',
  properties: {
    gericht: { type: 'string' },
    kcal: { type: 'number' },
    eiweiss: { type: 'number' },
    kohlenhydrate: { type: 'number' },
    fett: { type: 'number' },
    hinweis: { type: 'string' },
  },
  required: ['gericht', 'kcal', 'eiweiss', 'kohlenhydrate', 'fett', 'hinweis'],
  additionalProperties: false,
};

let photo = null; // { file, data (base64 JPEG), url }

function apiKey() {
  try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
}

function setApiKey(v) {
  try {
    if (v) localStorage.setItem(KEY_STORE, v);
    else localStorage.removeItem(KEY_STORE);
  } catch { /* privater Modus */ }
}

/* ---------- Daten ---------- */

function entries() {
  if (!Array.isArray(state.eatenOut)) state.eatenOut = [];
  return state.eatenOut;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Datum (YYYY-MM-DD) eines Tages im Wochenplan, 0 = Montag
export function planDate(dayIdx) {
  const [y, m, d] = ensurePlan().weekStart.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dayIdx);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function eatenOn(date) {
  return entries().filter((e) => e.date === date);
}

export function mealKey(meal) {
  return `${meal.slot}:${meal.index ?? 0}`;
}

// Geplante Mahlzeiten, die durch einen Eintrag ersetzt wurden
export function replacedKeys(date) {
  return new Set(eatenOn(date).map((e) => e.replaces).filter(Boolean));
}

// Tagessumme: Plan ohne ersetzte Mahlzeiten plus auswärts Gegessenes
export function dayTotals(dayIdx) {
  const day = ensurePlan().days[dayIdx];
  const date = planDate(dayIdx);
  const replaced = replacedKeys(date);
  const total = dayMacros(day);
  for (const meal of dayMeals(day)) {
    if (!replaced.has(mealKey(meal))) continue;
    const m = recipeMacros(getRecipe(meal.id), day.scale);
    total.kcal -= m.kcal; total.p -= m.p; total.c -= m.c; total.f -= m.f;
  }
  for (const e of eatenOn(date)) {
    total.kcal += e.kcal; total.p += e.p; total.c += e.c; total.f += e.f;
  }
  return total;
}

// Alte Einträge (älter als 8 Wochen) aufräumen
function prune() {
  const d = new Date();
  d.setDate(d.getDate() - 56);
  const limit = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  state.eatenOut = entries().filter((e) => e.date >= limit);
}

/* ---------- Anzeige im Tagesplan ---------- */

export function eatenRows(dayIdx) {
  return eatenOn(planDate(dayIdx)).map((e) => `
    <div class="row">
      <button class="grow plain" data-action="eo-edit" data-id="${e.id}">
        <div class="small muted">📷 Auswärts${e.replaces ? ` · statt ${esc(slotLabel(dayIdx, e.replaces))}` : ''}</div><div>${esc(e.name)}</div>
        <div class="small muted">${n0(e.kcal)} kcal · ${n0(e.p)} g Eiweiß · ${n0(e.c)} g KH · ${n0(e.f)} g Fett</div></button>
      <button class="btn ghost" data-action="eo-delete" data-id="${e.id}" aria-label="Eintrag löschen">✕</button>
    </div>`).join('');
}

function slotLabel(dayIdx, key) {
  const day = ensurePlan().days[dayIdx];
  const meal = dayMeals(day).find((m) => mealKey(m) === key);
  return meal ? meal.label : 'Mahlzeit';
}

function replaceOptions(dayIdx, selected) {
  const day = ensurePlan().days[dayIdx];
  const taken = replacedKeys(planDate(dayIdx));
  const opts = dayMeals(day).map((m) => {
    const key = mealKey(m);
    if (taken.has(key) && key !== selected) return '';
    return `<option value="${key}" ${key === selected ? 'selected' : ''}>statt ${m.label}: ${esc(getRecipe(m.id)?.name || '')}</option>`;
  }).join('');
  return `<option value="">Zusätzlich zum Plan</option>${opts}`;
}

/* ---------- Ablauf ---------- */

function guessSlot(dayIdx) {
  const h = new Date().getHours();
  const slot = h < 11 ? 'breakfast' : h < 16 ? 'lunch' : 'dinner';
  const key = `${slot}:0`;
  return replacedKeys(planDate(dayIdx)).has(key) ? '' : key;
}

function start(dayIdx) {
  photo = null;
  const hasKey = !!apiKey();
  const day = WEEKDAYS[WEEK_ORDER[dayIdx]];
  openSheet(`
    <h3>📷 Auswärts gegessen</h3>
    <div class="small muted">${day}, ${planDate(dayIdx).split('-').reverse().join('.')}</div>
    <label class="btn block" style="margin-top:12px">
      Foto aufnehmen oder auswählen
      <input type="file" accept="image/*" id="eo-file" hidden>
    </label>
    <img id="eo-preview" alt="" style="display:none;width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin-top:10px">
    <div class="list" style="margin-top:10px">
      <label class="field"><span>Ergänzung (optional)</span><input id="eo-note" autocomplete="off" placeholder="z. B. große Portion, ohne Pommes gegessen"></label>
      <label class="field"><span>Eintragen</span><select id="eo-replaces">${replaceOptions(dayIdx, guessSlot(dayIdx))}</select></label>
    </div>
    <p class="small warn" id="eo-error"></p>
    ${hasKey ? `
      <button class="btn block" data-action="eo-estimate" data-day="${dayIdx}">Mit Claude schätzen</button>
    ` : `
      <div class="card small">Ohne API-Schlüssel läuft die Schätzung über die Claude-App: Foto und Anfrage teilen, die Antwort kopieren und hier einfügen.</div>
      <button class="btn block" data-action="eo-share">1. An Claude schicken</button>
      <div class="list" style="margin-top:10px">
        <label class="field"><span>2. Antwort von Claude hier einfügen</span><textarea id="eo-answer" rows="3" placeholder='{"gericht": …}'></textarea></label>
      </div>
      <button class="btn secondary block" data-action="eo-paste" data-day="${dayIdx}">Übernehmen</button>
    `}
    <button class="btn ghost block" data-action="eo-manual" data-day="${dayIdx}" style="margin-top:8px">Werte selbst eintragen</button>
    <details class="card small" style="margin-top:10px">
      <summary>Automatisch mit eigenem API-Schlüssel</summary>
      <p>Mit einem Schlüssel aus der <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a> schätzt die App direkt, ohne Umweg über die Claude-App. Ein Foto kostet etwa 1 bis 3 Cent vom Guthaben dort. Der Schlüssel bleibt nur auf diesem Gerät und ist nicht im Backup.</p>
      <input id="eo-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${hasKey ? '••••••••' : ''}">
      <div class="flex" style="gap:8px;margin-top:8px">
        <button class="btn secondary small" data-action="eo-key-save" data-day="${dayIdx}">Speichern</button>
        ${hasKey ? `<button class="btn ghost small" data-action="eo-key-delete" data-day="${dayIdx}">Schlüssel löschen</button>` : ''}
      </div>
    </details>
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>`);
  document.getElementById('eo-file').addEventListener('change', (ev) => loadPhoto(ev.target.files[0]));
}

function error(msg) {
  const el = document.getElementById('eo-error');
  if (el) el.textContent = msg;
}

// Foto verkleinern (spart Kosten und Zeit) und als JPEG merken
async function loadPhoto(file) {
  if (!file) return;
  error('');
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * s);
    canvas.height = Math.round(bmp.height * s);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.82);
    const blob = await (await fetch(url)).blob();
    photo = { url, data: url.split(',')[1], file: new File([blob], 'essen.jpg', { type: 'image/jpeg' }) };
    const img = document.getElementById('eo-preview');
    img.src = url;
    img.style.display = 'block';
  } catch {
    error('Das Foto konnte nicht gelesen werden.');
  }
}

function promptText() {
  const note = document.getElementById('eo-note')?.value.trim();
  return note ? `${PROMPT}\n\nErgänzung: ${note}` : PROMPT;
}

function chosenReplace() {
  return document.getElementById('eo-replaces')?.value || '';
}

async function estimate(dayIdx, btn) {
  if (!photo) return error('Bitte zuerst ein Foto aufnehmen.');
  const replaces = chosenReplace();
  error('');
  btn.disabled = true;
  btn.textContent = 'Claude schaut sich das Foto an …';
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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.data } },
            { type: 'text', text: promptText() },
          ],
        }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Error('Der API-Schlüssel stimmt nicht.');
      if (res.status === 400 && /credit/i.test(body.error?.message || '')) throw new Error('Kein Guthaben mehr in der Anthropic Console.');
      throw new Error(body.error?.message || `Fehler ${res.status}`);
    }
    if (body.stop_reason === 'refusal') throw new Error('Claude konnte das Foto nicht auswerten.');
    const text = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    review(dayIdx, parseAnswer(text), replaces);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Mit Claude schätzen';
    error(e.message === 'Failed to fetch' ? 'Keine Verbindung. Bist du online?' : e.message);
  }
}

// Liest das JSON aus der Antwort, auch wenn Claude etwas Text drumherum schreibt
function parseAnswer(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('In der Antwort stehen keine Nährwerte. Bitte die ganze Antwort von Claude einfügen.');
  let j;
  try {
    j = JSON.parse(match[0].replace(/[“”]/g, '"'));
  } catch {
    throw new Error('Die Antwort ließ sich nicht lesen. Bitte die ganze Antwort von Claude einfügen.');
  }
  const n = (v) => Math.max(0, Math.round(parseFloat(String(v ?? 0).replace(',', '.')) || 0));
  return { name: String(j.gericht || 'Auswärts gegessen'), kcal: n(j.kcal), p: n(j.eiweiss), c: n(j.kohlenhydrate), f: n(j.fett), note: String(j.hinweis || '') };
}

async function share() {
  if (!photo) return error('Bitte zuerst ein Foto aufnehmen.');
  error('');
  const text = promptText();
  const data = { files: [photo.file], text };
  try { await navigator.clipboard.writeText(text); } catch { /* nicht schlimm */ }
  if (navigator.canShare && navigator.canShare(data)) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  error('Die Anfrage ist kopiert. Öffne die Claude-App, hänge das Foto an, füge den Text ein und schicke ihn ab.');
}

// Formular zum Prüfen und Korrigieren, vor dem Speichern
function review(dayIdx, est, replaces, id = null) {
  const field = (name, label, value) => `<label class="field"><span>${label}</span><input name="${name}" type="text" inputmode="decimal" value="${value}"></label>`;
  openSheet(`
    <form data-form="eaten-out" data-day="${dayIdx}" ${id ? `data-id="${id}"` : ''}>
      <h3>${id ? 'Eintrag bearbeiten' : 'Passt das so?'}</h3>
      ${photo && !id ? `<img src="${photo.url}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px">` : ''}
      ${est.note ? `<p class="small muted">Claude: ${esc(est.note)}</p>` : ''}
      <div class="list">
        <label class="field"><span>Gericht</span><input name="name" autocomplete="off" value="${esc(est.name)}"></label>
        ${field('kcal', 'Kalorien (kcal)', est.kcal)}
        ${field('p', 'Eiweiß (g)', est.p)}
        ${field('c', 'Kohlenhydrate (g)', est.c)}
        ${field('f', 'Fett (g)', est.f)}
        <label class="field"><span>Eintragen</span><select name="replaces">${replaceOptions(dayIdx, replaces)}</select></label>
      </div>
      <p class="small muted">Fotos sind nur eine Schätzung. Korrigiere die Werte, wenn du es besser weißt.</p>
      <p class="small warn" id="eo-error"></p>
      <button class="btn block" type="submit">Speichern</button>
      <button class="btn secondary block" type="button" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>
    </form>`);
}

export function submitEatenOut(form) {
  const f = form.elements;
  const num = (n) => Math.max(0, Math.round(parseFloat(String(f[n].value).replace(',', '.')) || 0));
  const name = f.name.value.trim() || 'Auswärts gegessen';
  const kcal = num('kcal');
  if (!kcal) return error('Bitte die Kalorien eintragen.');
  const dayIdx = Number(form.dataset.day);
  const entry = { id: form.dataset.id || `eo${Date.now().toString(36)}`, date: planDate(dayIdx), name, kcal, p: num('p'), c: num('c'), f: num('f'), replaces: f.replaces.value || null };
  const list = entries();
  const i = list.findIndex((e) => e.id === entry.id);
  if (i >= 0) list[i] = { ...list[i], ...entry, date: list[i].date };
  else list.push(entry);
  prune();
  save();
  photo = null;
  closeSheet();
  rerender();
}

export const photoActions = {
  'eo-start'(el) {
    start(Number(el.dataset.day));
  },
  'eo-estimate'(el) {
    estimate(Number(el.dataset.day), el);
  },
  'eo-share'() {
    share();
  },
  async 'eo-paste'(el) {
    const box = document.getElementById('eo-answer');
    if (!box.value.trim()) {
      try { box.value = await navigator.clipboard.readText(); } catch { /* Nutzer fügt selbst ein */ }
    }
    if (!box.value.trim()) return error('Bitte die Antwort von Claude einfügen.');
    try {
      review(Number(el.dataset.day), parseAnswer(box.value), chosenReplace());
    } catch (e) {
      error(e.message);
    }
  },
  'eo-manual'(el) {
    review(Number(el.dataset.day), { name: '', kcal: '', p: '', c: '', f: '' }, chosenReplace());
  },
  'eo-key-save'(el) {
    const v = document.getElementById('eo-key').value.trim();
    if (v.startsWith('••')) return;
    if (!v.startsWith('sk-ant-')) return error('Der Schlüssel beginnt mit „sk-ant-“.');
    setApiKey(v);
    start(Number(el.dataset.day));
  },
  'eo-key-delete'(el) {
    setApiKey('');
    start(Number(el.dataset.day));
  },
  'eo-edit'(el) {
    const e = entries().find((x) => x.id === el.dataset.id);
    if (!e) return;
    const dayIdx = [0, 1, 2, 3, 4, 5, 6].find((i) => planDate(i) === e.date) ?? 0;
    photo = null;
    review(dayIdx, e, e.replaces, e.id);
  },
  'eo-delete'(el) {
    const e = entries().find((x) => x.id === el.dataset.id);
    if (!e || !confirm(`„${e.name}“ löschen?`)) return;
    state.eatenOut = entries().filter((x) => x.id !== e.id);
    save();
    rerender();
  },
};
