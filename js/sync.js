// Gemeinsamer Ernährungsplan und Einkaufsliste mit einer zweiten App (z. B. Calisthenics + Gym).
// Beide Apps lesen und schreiben denselben Haushalt in einer Firebase Realtime Database
// (REST-API + Live-Stream, ohne SDK). Ohne Verbindung läuft alles wie bisher lokal.
//
// households/<code>/plan     = { weekStart, days: [{ breakfast, lunch, dinner, snacks }], by }
// households/<code>/shopping = { weekStart, checked: { zutat: true }, custom: { key: { name, done } } }
// households/<code>/members  = { <memberId>: { name, kcal, app, off: [abgewählte Rezepte] } }
// households/<code>/recipes  = { <id>: eigenes Rezept }, ingredients = { <id>: eigene Zutat }
// households/<code>/inbox/<memberId> = { <pushId>: { text } } = Health-Werte vom Kurzbefehl, nur für diese Person
import { state, save } from './store.js';

const APP = 'calisthenics';

let remote; // undefined = noch nicht geladen, null = Haushalt leer
let source = null;
let listener = () => {};
let retryTimer = null;
export const syncStatus = { value: 'off' }; // off | connecting | online | offline | error

export function isLinked() {
  return !!(state.sync && state.sync.db && state.sync.code);
}

export function onRemoteChange(fn) {
  listener = fn;
}

function base() {
  return `${state.sync.db.replace(/\/+$/, '')}/households/${state.sync.code}`;
}

/* ---------- Lokales Abbild ---------- */

function getAt(obj, parts) {
  return parts.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setAt(path, data, merge) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) {
    remote = merge ? { ...(remote || {}), ...data } : data;
    return;
  }
  if (remote == null) remote = {};
  let o = remote;
  for (const k of parts.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  const last = parts[parts.length - 1];
  if (merge) o[last] = { ...(o[last] || {}), ...data };
  else if (data === null) delete o[last];
  else o[last] = data;
}

function changed() {
  state.syncCache = remote ?? null;
  save();
  listener();
}

/* ---------- Schreiben (mit Warteschlange, falls offline) ---------- */

async function send({ path, method, body }) {
  const res = await fetch(`${base()}${path}.json`, { method, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Firebase antwortet mit ${res.status}`);
}

async function flush() {
  const queue = state.syncQueue || [];
  while (queue.length) {
    try {
      await send(queue[0]);
      queue.shift();
      save();
    } catch {
      syncStatus.value = navigator.onLine ? 'error' : 'offline';
      return;
    }
  }
}

function write(path, method, body) {
  setAt(path, body, method === 'PATCH');
  changed();
  if (!state.syncQueue) state.syncQueue = [];
  state.syncQueue.push({ path, method, body });
  save();
  flush();
}

/* ---------- Verbinden ---------- */

export function start() {
  stop();
  if (!isLinked()) return;
  if (remote === undefined && state.syncCache !== undefined) remote = state.syncCache;
  syncStatus.value = 'connecting';
  try {
    source = new EventSource(`${base()}.json`);
  } catch {
    syncStatus.value = 'error';
    return;
  }
  const handle = (merge) => (e) => {
    const { path, data } = JSON.parse(e.data);
    setAt(path, data, merge);
    syncStatus.value = 'online';
    changed();
  };
  source.addEventListener('put', handle(false));
  source.addEventListener('patch', handle(true));
  source.addEventListener('open', () => {
    syncStatus.value = 'online';
    publishMember();
    flush();
  });
  source.addEventListener('cancel', () => { syncStatus.value = 'error'; listener(); });
  source.onerror = () => {
    syncStatus.value = navigator.onLine ? 'connecting' : 'offline';
    // EventSource verbindet sich selbst neu; bei endgültigem Abbruch neu starten
    if (source && source.readyState === EventSource.CLOSED) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(start, 10000);
    }
  };
}

export function stop() {
  if (source) source.close();
  source = null;
  syncStatus.value = 'off';
}

window.addEventListener('online', () => { if (isLinked()) start(); });

export function memberId() {
  if (!state.sync.member) {
    state.sync.member = randomCode(10);
    save();
  }
  return state.sync.member;
}

export function publishMember(kcal = state.sync.kcal) {
  if (!isLinked()) return;
  state.sync.kcal = kcal;
  const me = { name: state.sync.name || 'Ich', kcal: kcal || 2000, app: APP, off: state.recipeOff || [] };
  const cur = remote?.members?.[memberId()];
  if (cur && cur.name === me.name && cur.kcal === me.kcal && (cur.off || []).join() === me.off.join()) return;
  write(`/members/${memberId()}`, 'PUT', me);
}

function randomCode(n) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

export function validDbUrl(url) {
  // localhost nur für Tests mit einem lokalen Nachbau
  return /^https:\/\/([a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)|localhost:\d+)\/?$/i.test(url.trim());
}

// Prüft die Datenbank und legt einen neuen Haushalt mit dem eigenen Plan an
export async function createHousehold(db, name, plan) {
  const code = randomCode(24);
  const url = db.trim().replace(/\/+$/, '');
  const res = await fetch(`${url}/households/${code}/created.json`, { method: 'PUT', body: JSON.stringify(new Date().toISOString()) });
  if (!res.ok) throw new Error(res.status === 401 ? 'Zugriff verweigert. Sind die Regeln aus der Anleitung eingetragen?' : `Fehler ${res.status}`);
  state.sync = { db: url, code, name, member: state.sync?.member };
  state.syncQueue = [];
  remote = { created: true };
  if (plan) write('/plan', 'PUT', planForShare(plan));
  write('/shopping', 'PUT', {
    weekStart: state.shopping.weekStart,
    checked: state.shopping.checked,
    custom: Object.fromEntries(state.shopping.custom.map((c) => [randomCode(8), { name: c.name, done: !!c.done }])),
  });
  shareOwnRecipes();
  start();
}

export async function joinHousehold(invite, name) {
  const [db, code] = invite.trim().split('#');
  if (!validDbUrl(db || '') || !code || code.length < 20) throw new Error('Die Einladung ist unvollständig. Bitte den ganzen Text kopieren.');
  const url = db.trim().replace(/\/+$/, '');
  const res = await fetch(`${url}/households/${code}.json`);
  if (!res.ok) throw new Error(`Fehler ${res.status}`);
  const data = await res.json();
  if (!data) throw new Error('Diesen gemeinsamen Plan gibt es nicht (mehr).');
  state.sync = { db: url, code, name, member: state.sync?.member };
  state.syncQueue = [];
  remote = data;
  changed();
  shareOwnRecipes();
  start();
}

export function unlink() {
  if (isLinked() && remote?.members?.[state.sync.member]) {
    fetch(`${base()}/members/${state.sync.member}.json`, { method: 'DELETE' }).catch(() => {});
  }
  stop();
  remote = undefined;
  state.sync = { member: state.sync?.member };
  state.syncCache = undefined;
  state.syncQueue = [];
  save();
}

export function inviteText() {
  return `${state.sync.db}#${state.sync.code}`;
}

export function members() {
  return Object.entries(remote?.members || {}).map(([id, m]) => ({ id, ...m, me: id === state.sync.member }));
}

/* ---------- Wochenplan ---------- */

function planForShare(plan) {
  return {
    weekStart: plan.weekStart,
    by: state.sync?.name || '',
    days: plan.days.map((d) => ({ breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner, snacks: d.snacks })),
  };
}

// undefined = noch nicht geladen, null = noch kein gemeinsamer Plan
export function remotePlan() {
  if (remote === undefined) return undefined;
  const p = remote?.plan;
  if (!p || !Array.isArray(p.days)) return null;
  return { ...p, days: p.days.map((d) => ({ ...d, snacks: d.snacks || [] })) };
}

export function sharePlan(plan) {
  if (isLinked()) write('/plan', 'PUT', planForShare(plan));
}

/* ---------- Eigene Rezepte ---------- */

// undefined = noch nicht geladen
export function remoteCustom() {
  if (remote === undefined) return undefined;
  return { recipes: Object.values(remote?.recipes || {}), ingredients: remote?.ingredients || {} };
}

// Beim Verbinden: eigene Rezepte, die der gemeinsame Plan noch nicht kennt, hochladen
function shareOwnRecipes() {
  for (const [id, ing] of Object.entries(state.customIngredients || {})) {
    if (!remote?.ingredients?.[id]) write(`/ingredients/${id}`, 'PUT', ing);
  }
  for (const r of state.customRecipes || []) {
    if (!remote?.recipes?.[r.id]) write(`/recipes/${r.id}`, 'PUT', r);
  }
}

export function putRecipe(r) {
  if (isLinked()) write(`/recipes/${r.id}`, 'PUT', r);
}

export function deleteRecipe(id) {
  if (isLinked()) write(`/recipes/${id}`, 'PUT', null);
}

export function putIngredient(ing) {
  if (isLinked()) write(`/ingredients/${ing.id}`, 'PUT', ing);
}

// Rezepte, die irgendwer im gemeinsamen Plan abgewählt hat
export function othersOff() {
  return members().filter((m) => !m.me).flatMap((m) => m.off || []);
}

export { randomCode };

/* ---------- Einkaufsliste ---------- */

export function shoppingState(weekStart) {
  if (!isLinked()) {
    if (state.shopping.weekStart !== weekStart) {
      state.shopping.weekStart = weekStart;
      state.shopping.checked = {};
      save();
    }
    return {
      checked: state.shopping.checked,
      custom: state.shopping.custom.map((c, i) => ({ key: String(i), name: c.name, done: c.done })),
    };
  }
  const s = remote?.shopping || {};
  if (remote !== undefined && s.weekStart !== weekStart) {
    // Neue Woche: Häkchen zurücksetzen, offene eigene Einträge behalten
    const custom = Object.fromEntries(Object.entries(s.custom || {}).filter(([, c]) => !c.done));
    write('/shopping', 'PUT', { weekStart, checked: {}, custom });
  }
  const cur = remote?.shopping || {};
  return {
    checked: cur.checked || {},
    custom: Object.entries(cur.custom || {}).map(([key, c]) => ({ key, name: c.name, done: !!c.done })),
  };
}

export function setChecked(id, on) {
  if (!isLinked()) {
    state.shopping.checked[id] = on;
    save();
    return;
  }
  write(`/shopping/checked/${id}`, 'PUT', on ? true : null);
}

export function addCustomItem(name) {
  if (!isLinked()) {
    state.shopping.custom.push({ name, done: false });
    save();
    return;
  }
  write(`/shopping/custom/${Date.now().toString(36)}${randomCode(4)}`, 'PUT', { name, done: false });
}

export function setCustomDone(key, done) {
  if (!isLinked()) {
    state.shopping.custom[Number(key)].done = done;
    save();
    return;
  }
  write(`/shopping/custom/${key}/done`, 'PUT', done);
}

export function delCustomItem(key) {
  if (!isLinked()) {
    state.shopping.custom.splice(Number(key), 1);
    save();
    return;
  }
  write(`/shopping/custom/${key}`, 'PUT', null);
}

export function resetChecks() {
  if (!isLinked()) {
    state.shopping.checked = {};
    state.shopping.custom = state.shopping.custom.filter((c) => !c.done);
    save();
    return;
  }
  const custom = Object.fromEntries(Object.entries(remote?.shopping?.custom || {}).filter(([, c]) => !c.done));
  write('/shopping', 'PUT', { weekStart: remote?.shopping?.weekStart, checked: {}, custom });
}

/* ---------- Health-Werte vom Kurzbefehl ---------- */

// Adresse, an die der Kurzbefehl die Werte des Tages schickt (POST { text })
export function inboxUrl() {
  return isLinked() ? `${base()}/inbox/${memberId()}.json` : '';
}

// Aus dem Live-Abbild (kommt über den Stream an)
export function inboxEntries() {
  return isLinked() ? Object.entries(remote?.inbox?.[memberId()] || {}) : [];
}

// Direkt abfragen, z. B. gleich nach dem Kurzbefehl
export async function fetchInbox() {
  if (!isLinked()) return [];
  const res = await fetch(inboxUrl());
  if (!res.ok) throw new Error(`Firebase antwortet mit ${res.status}`);
  return Object.entries((await res.json()) || {});
}

export function clearInbox(id) {
  write(`/inbox/${memberId()}/${id}`, 'DELETE', null);
}
