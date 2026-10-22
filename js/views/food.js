// Ernährung: Wochenplan, Rezepte und Einkaufsliste
import { getRecipe, allRecipes, allIngredients, CATEGORIES } from '../data/food.js';
import {
  targets, recipeMacros, dayMeals, dayMacros, ensurePlan, generatePlan, swapMeal, setMeal, pool, shoppingList, scaledItems,
} from '../nutrition.js';
import {
  isLinked, members, shoppingState, setChecked, addCustomItem, setCustomDone, delCustomItem, resetChecks, othersOff,
} from '../sync.js';
import { refreshCustom, isCustom, isOff, setOff, saveRecipe, removeRecipe, saveIngredient } from '../recipes.js';
import { state } from '../store.js';
import { dayTotals, eatenRows, eatButton, planDate, replacedKeys, mealKey } from '../photo.js';
import { ui, esc, n0, todayIdx, WEEKDAYS, WEEK_ORDER, openSheet, closeSheet, rerender } from '../ui.js';

const KINDS = [
  { slot: 'breakfast', label: 'Frühstück' },
  { slot: 'main', label: 'Mittag & Abend' },
  { slot: 'snack', label: 'Snacks' },
];

export function viewFood() {
  refreshCustom();
  const tab = (v, label) => `<button class="${ui.foodTab === v ? 'on' : ''}" data-action="food-tab" data-v="${v}">${label}</button>`;
  const tabs = `<div class="daytabs">${tab('plan', '🥗 Plan')}${tab('recipes', '📖 Rezepte')}${tab('shop', '🛒 Einkauf')}</div>`;
  if (ui.foodTab === 'shop') return tabs + shopping();
  if (ui.foodTab === 'recipes') return tabs + recipes();
  return tabs + plan();
}

function plan() {
  const p = ensurePlan();
  const t = targets();
  const d = ui.foodDay;
  const day = p.days[d];
  const m = dayTotals(d);
  const replaced = replacedKeys(planDate(d));

  const tabs = WEEK_ORDER.map((wd, i) => `<button class="${i === d ? 'on' : ''} ${i === todayIdx() ? 'today' : ''}" data-action="food-day" data-idx="${i}">${WEEKDAYS[wd]}</button>`).join('');

  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    const out = replaced.has(mealKey(meal));
    return `<div class="row ex-row ${out ? 'off' : ''}">
      ${out ? '<span class="eat-spacer"></span>' : eatButton(d, meal)}
      <button class="grow plain ex-name" data-action="recipe" data-day="${d}" data-id="${r.id}">
        <div class="small muted">${meal.label} · ${out ? 'etwas anderes gegessen' : `${r.time} Min`}</div><div>${esc(r.name)}</div>
        <div class="small muted">${n0(mm.kcal)} kcal · ${n0(mm.p)} g Eiweiß</div></button>
      <button class="btn ghost" data-action="swap" data-day="${d}" data-slot="${meal.slot}" data-index="${meal.index ?? 0}" aria-label="Gericht tauschen">🔄</button>
    </div>`;
  }).join('');

  return `
    <div class="daytabs small-tabs">${tabs}</div>
    <div class="card">
      <div class="flex between"><b>${n0(m.kcal)} kcal gegessen</b><span class="muted small">Ziel ${n0(t.kcal)} kcal · ${t.protein} g Eiweiß</span></div>
      <div class="small muted">Laut Plan ${n0(m.planned)} kcal${m.open ? ` · ${m.open} ${m.open === 1 ? 'Mahlzeit' : 'Mahlzeiten'} noch nicht abgehakt` : ''}</div>
      <div class="macros">
        <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
        <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
        <div><b>${n0(m.f)} g</b><span>Fett</span></div>
        <div><b>×${day.scale.toLocaleString('de-DE')}</b><span>Portion</span></div>
      </div>
    </div>
    <div class="list">${meals}${eatenRows(d)}</div>
    <button class="btn block" data-action="eo-start" data-day="${d}">🍽️ Etwas anderes gegessen</button>
    <p class="small muted">Hake ab, was du gegessen hast. Nur das zählt in deine Tageswerte. Hast du etwas anderes gegessen, trag es über den Knopf oben ein, mit Rezept, eigenen Werten oder Foto. Die Portionsgrößen werden automatisch an dein Kalorienziel angepasst. Mit 🔄 suchst du dir ein anderes Gericht aus.${isLinked() ? ' Der Plan ist gemeinsam: Änderungen sieht auch die andere App.' : ''}</p>
    <button class="btn secondary block" data-action="new-plan">Neuen Wochenplan erstellen</button>`;
}

/* ---------- Alle Rezepte ---------- */

function recipes() {
  const veg = state.profile.vegetarian;
  const others = new Set(isLinked() ? othersOff() : []);
  const groups = KINDS.map((k) => {
    const rows = allRecipes().filter((r) => r.slot === k.slot).map((r) => {
      const off = isOff(r.id);
      const m = recipeMacros(r);
      const pills = [
        isCustom(r.id) ? '<span class="pill">eigenes</span>' : '',
        veg && !r.veg ? '<span class="pill warn">nicht vegetarisch</span>' : '',
        !off && others.has(r.id) ? '<span class="pill warn">von der anderen Person abgewählt</span>' : '',
      ].join(' ');
      return `<div class="row ex-row ${off || (veg && !r.veg) ? 'off' : ''}">
        <button class="grow plain ex-name" data-action="recipe" data-id="${r.id}">
          <div>${esc(r.name)} ${pills}</div>
          <div class="small muted">${r.time} Min · ${n0(m.kcal)} kcal · ${n0(m.p)} g Eiweiß${r.veg ? ' · vegetarisch' : ''}</div></button>
        <input type="checkbox" class="switch" data-action="toggle-recipe" data-id="${r.id}" ${off ? '' : 'checked'} aria-label="${esc(r.name)} im Wochenplan">
      </div>`;
    }).join('');
    return `<h2>${k.label}</h2><div class="list">${rows}</div>`;
  }).join('');

  return `
    <p class="small muted" style="margin-top:0">Tippe auf ein Gericht für Zutaten und Zubereitung. Mit dem Schalter legst du fest, ob es im Wochenplan vorkommen darf.${isLinked() ? ' Im gemeinsamen Plan landen nur Gerichte, die keiner von euch abgewählt hat. Eigene Rezepte sehen beide Apps.' : ''} Nährwerte gelten für eine Grundportion.</p>
    <button class="btn block" data-action="rc-new">＋ Eigenes Rezept</button>
    ${groups}`;
}

function showRecipe(dayIdx, id) {
  const p = ensurePlan();
  const scale = p.days[dayIdx]?.scale ?? 1;
  const r = getRecipe(id);
  if (!r) return;
  const m = recipeMacros(r, scale);
  const custom = isCustom(id);
  openSheet(`
    <h3>${esc(r.name)}</h3>
    <div class="small muted">${r.time} Min${r.veg ? ' · vegetarisch' : ''}${custom ? ' · eigenes Rezept' : ''} · 1 Portion (×${scale.toLocaleString('de-DE')})</div>
    <div class="card macros" style="margin-top:12px">
      <div><b>${n0(m.kcal)}</b><span>kcal</span></div>
      <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
      <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
      <div><b>${n0(m.f)} g</b><span>Fett</span></div>
    </div>
    <h2>Zutaten</h2>
    <div class="list">${scaledItems(r, scale).map((i) => `<div class="row"><div class="grow">${esc(i.name)}</div><div class="muted small">${i.amount}</div></div>`).join('')}</div>
    <p class="small muted">Salz, Pfeffer und Gewürze nach Geschmack.</p>
    ${r.steps.length ? `<h2>Zubereitung</h2>
    <div class="card"><ol style="margin:0;padding-left:20px">${r.steps.map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${custom
    ? `<button class="btn secondary block" data-action="rc-edit" data-id="${r.id}">Bearbeiten</button>
       <button class="btn ghost block" data-action="rc-delete" data-id="${r.id}">Rezept löschen</button>`
    : `<button class="btn secondary block" data-action="rc-copy" data-id="${r.id}">Als eigenes Rezept abwandeln</button>`}
    <button class="btn block" data-action="close-sheet" style="margin-top:8px">Schließen</button>`);
}

/* ---------- Gericht für eine Mahlzeit auswählen ---------- */

function chooseMeal(dayIdx, slot, index) {
  const day = state.mealPlan.days[dayIdx];
  const current = slot === 'snack' ? day.snacks[index] : day[slot];
  const label = dayMeals(day).find((x) => x.slot === slot && (x.index ?? 0) === index)?.label || '';
  const data = `data-day="${dayIdx}" data-slot="${slot}" data-index="${index}"`;
  const rows = pool(slot).map((r) => {
    const m = recipeMacros(r);
    return `<div class="row"><button class="grow plain" data-action="pick-meal" ${data} data-id="${r.id}">
      <div>${esc(r.name)} ${r.id === current ? '<span class="pill good">aktuell</span>' : ''}</div>
      <div class="small muted">${r.time} Min · ${n0(m.kcal)} kcal · ${n0(m.p)} g Eiweiß (Grundportion)</div></button></div>`;
  }).join('');
  openSheet(`
    <h3>${label} am ${WEEKDAYS[WEEK_ORDER[dayIdx]]}</h3>
    <button class="btn block" data-action="swap-random" ${data}>🎲 Zufällig tauschen</button>
    <h2>Oder selbst aussuchen</h2>
    <div class="list">${rows}</div>
    <p class="small muted">Abgewählte Gerichte stehen hier nicht. Du kannst sie unter 📖 Rezepte wieder einschalten.</p>
    <button class="btn secondary block" data-action="close-sheet">Abbrechen</button>`);
}

/* ---------- Eigenes Rezept anlegen / bearbeiten ---------- */

function ingredientOptions(selected) {
  const all = Object.entries(allIngredients()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'));
  return `<option value="">Zutat wählen …</option>${all.map(([id, i]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(i.name)} (${i.unit || 'g'})</option>`).join('')}`;
}

function itemRow(id = '', grams = '') {
  return `<div class="check-row rc-item">
    <select name="ing">${ingredientOptions(id)}</select>
    <input name="g" type="text" inputmode="decimal" placeholder="Menge" value="${grams}" aria-label="Menge in g bzw. ml">
    <button type="button" class="btn ghost small" data-action="rc-del-item" aria-label="Zutat entfernen">✕</button></div>`;
}

function recipeEditor(r = null, copy = false) {
  const editing = r && !copy;
  const items = r ? Object.entries(r.items) : [];
  const kind = r?.slot || 'main';
  openSheet(`
    <form data-form="recipe" ${editing ? `data-id="${r.id}"` : ''}>
      <h3>${editing ? 'Rezept bearbeiten' : 'Eigenes Rezept'}</h3>
      <div class="list">
        <label class="field"><span>Name</span><input name="rc-name" value="${esc(r ? (copy ? `${r.name} (meine Variante)` : r.name) : '')}" autocomplete="off" placeholder="z. B. Omas Linsensuppe"></label>
        <label class="field"><span>Mahlzeit</span><select name="rc-slot">${KINDS.map((k) => `<option value="${k.slot}" ${k.slot === kind ? 'selected' : ''}>${k.label}</option>`).join('')}</select></label>
        <label class="field"><span>Zubereitungszeit in Minuten</span><input name="rc-time" type="text" inputmode="numeric" value="${r?.time ?? 20}"></label>
        <label class="check-row"><span class="grow">Vegetarisch</span><input type="checkbox" class="switch" name="rc-veg" ${r?.veg ? 'checked' : ''}></label>
      </div>
      <h2>Zutaten für 1 Portion</h2>
      <p class="small muted">Menge in g bzw. ml. Die App passt die Portion später an euer Kalorienziel an.</p>
      <div class="list" id="rc-items">${(items.length ? items : [['', '']]).map(([id, g]) => itemRow(id, g)).join('')}</div>
      <button type="button" class="btn secondary block" data-action="rc-add-item">＋ Weitere Zutat</button>
      <details class="card" id="rc-newing" style="margin-top:10px">
        <summary>Zutat fehlt? Neue Zutat anlegen</summary>
        <p class="small muted">Nährwerte je 100 g bzw. 100 ml, steht auf der Verpackung.</p>
        <div class="list">
          <label class="field"><span>Name</span><input id="ni-name" autocomplete="off" placeholder="z. B. Grünkohl"></label>
          <label class="field"><span>Kalorien (kcal)</span><input id="ni-kcal" type="text" inputmode="decimal"></label>
          <label class="field"><span>Eiweiß (g)</span><input id="ni-p" type="text" inputmode="decimal"></label>
          <label class="field"><span>Kohlenhydrate (g)</span><input id="ni-c" type="text" inputmode="decimal"></label>
          <label class="field"><span>Fett (g)</span><input id="ni-f" type="text" inputmode="decimal"></label>
          <label class="field"><span>Abteilung im Supermarkt</span><select id="ni-cat">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label class="field"><span>Einheit</span><select id="ni-unit"><option value="g">Gramm</option><option value="ml">Milliliter</option></select></label>
        </div>
        <p class="small warn" id="ni-error"></p>
        <button type="button" class="btn secondary block" data-action="rc-save-ing">Zutat anlegen</button>
      </details>
      <h2>Zubereitung</h2>
      <div class="list"><label class="field"><span>Ein Schritt pro Zeile</span><textarea name="rc-steps" rows="5">${esc((r?.steps || []).join('\n'))}</textarea></label></div>
      <p class="small warn" id="rc-error"></p>
      <button class="btn block" type="submit">Speichern</button>
      <button class="btn secondary block" type="button" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>
    </form>`);
}

function num(v) {
  return parseFloat(String(v).replace(',', '.'));
}

export function submitRecipe(form) {
  const error = (msg) => { form.querySelector('#rc-error').textContent = msg; };
  const f = (n) => form.querySelector(`[name="rc-${n}"]`);
  const name = f('name').value.trim();
  if (!name) return error('Bitte gib dem Rezept einen Namen.');
  const items = {};
  form.querySelectorAll('.rc-item').forEach((row) => {
    const id = row.querySelector('[name=ing]').value;
    const g = num(row.querySelector('[name=g]').value);
    if (id && g > 0) items[id] = (items[id] || 0) + Math.round(g);
  });
  if (!Object.keys(items).length) return error('Bitte mindestens eine Zutat mit Menge eintragen.');
  const r = saveRecipe({
    id: form.dataset.id || undefined,
    name,
    slot: f('slot').value,
    veg: f('veg').checked,
    time: Math.max(1, Math.round(num(f('time').value)) || 20),
    items,
    steps: f('steps').value.split('\n').map((s) => s.trim()).filter(Boolean),
  });
  closeSheet();
  rerender();
  showRecipe(NaN, r.id);
}

function addIngredient() {
  const val = (id) => document.getElementById(id).value;
  const err = document.getElementById('ni-error');
  const name = val('ni-name').trim();
  const kcal = num(val('ni-kcal'));
  if (!name) { err.textContent = 'Bitte einen Namen eingeben.'; return; }
  if (!(kcal >= 0)) { err.textContent = 'Bitte die Kalorien je 100 g eingeben.'; return; }
  const ing = saveIngredient({
    name, kcal, p: num(val('ni-p')) || 0, c: num(val('ni-c')) || 0, f: num(val('ni-f')) || 0,
    cat: val('ni-cat'), ...(val('ni-unit') === 'ml' ? { unit: 'ml' } : {}),
  });
  // Neue Zutat in allen Auswahllisten anbieten und in die erste leere Zeile setzen
  const box = document.getElementById('rc-items');
  box.querySelectorAll('select[name=ing]').forEach((s) => {
    const v = s.value;
    s.innerHTML = ingredientOptions(v);
  });
  let empty = [...box.querySelectorAll('select[name=ing]')].find((s) => !s.value);
  if (!empty) {
    box.insertAdjacentHTML('beforeend', itemRow());
    empty = box.lastElementChild.querySelector('select');
  }
  empty.value = ing.id;
  empty.closest('.rc-item').querySelector('[name=g]').focus();
  ['ni-name', 'ni-kcal', 'ni-p', 'ni-c', 'ni-f'].forEach((id) => { document.getElementById(id).value = ''; });
  err.textContent = '';
  document.getElementById('rc-newing').open = false;
}

/* ---------- Einkaufsliste ---------- */

function shopping() {
  const p = ensurePlan();
  const shop = shoppingState(p.weekStart);
  const groups = shoppingList(ui.shopFromToday ? todayIdx() : 0);
  const checked = shop.checked;

  const list = groups.map((g) => `
    <h2>${g.cat}</h2>
    <div class="list">${g.items.map((i) => `
      <label class="check-row ${checked[i.id] ? 'checked' : ''}">
        <input type="checkbox" data-action="check" data-id="${i.id}" ${checked[i.id] ? 'checked' : ''}>
        <span class="grow name">${esc(i.name)}</span><span class="amount">${i.amount}</span></label>`).join('')}</div>`).join('');

  const custom = shop.custom.map((c) => `
    <div class="check-row ${c.done ? 'checked' : ''}">
      <input type="checkbox" data-action="check-custom" data-key="${c.key}" ${c.done ? 'checked' : ''}>
      <span class="grow name">${esc(c.name)}</span>
      <button class="btn ghost small" data-action="del-custom" data-key="${c.key}" aria-label="Löschen">✕</button></div>`).join('');

  const people = isLinked() ? members() : [];
  const shared = people.length > 1
    ? `<div class="card small">👫 Gemeinsame Liste für ${people.map((m) => esc(m.name)).join(' und ')}. Mengen für alle zusammen, Häkchen sehen alle sofort.</div>`
    : '';

  return `
    <div class="daytabs small-tabs">
      <button class="${ui.shopFromToday ? '' : 'on'}" data-action="shop-range" data-v="0">Ganze Woche</button>
      <button class="${ui.shopFromToday ? 'on' : ''}" data-action="shop-range" data-v="1">Ab heute</button>
    </div>
    ${shared}
    ${list}
    <h2>Eigene Einträge</h2>
    <div class="list">
      ${custom}
      <form class="check-row" data-form="add-custom">
        <input name="item" placeholder="z. B. Spülmittel" autocomplete="off">
        <button class="btn small" type="submit">+</button>
      </form>
    </div>
    <button class="btn secondary block" data-action="reset-checks">Häkchen zurücksetzen</button>`;
}

export const foodActions = {
  'food-tab'(el) {
    ui.foodTab = el.dataset.v;
    rerender();
  },
  'food-day'(el) {
    ui.foodDay = Number(el.dataset.idx);
    rerender();
  },
  recipe(el) {
    showRecipe(Number(el.dataset.day), el.dataset.id);
  },
  swap(el) {
    chooseMeal(Number(el.dataset.day), el.dataset.slot, Number(el.dataset.index));
  },
  'swap-random'(el) {
    swapMeal(Number(el.dataset.day), el.dataset.slot, Number(el.dataset.index));
    closeSheet();
    rerender();
  },
  'pick-meal'(el) {
    setMeal(Number(el.dataset.day), el.dataset.slot, Number(el.dataset.index), el.dataset.id);
    closeSheet();
    rerender();
  },
  'new-plan'() {
    if (!confirm('Neuen Wochenplan mit anderen Gerichten erstellen?')) return;
    generatePlan();
    rerender();
  },
  'rc-new'() {
    recipeEditor();
  },
  'rc-edit'(el) {
    recipeEditor(getRecipe(el.dataset.id));
  },
  'rc-copy'(el) {
    recipeEditor(getRecipe(el.dataset.id), true);
  },
  'rc-delete'(el) {
    if (!confirm(`„${getRecipe(el.dataset.id).name}“ löschen?${isLinked() ? ' Es verschwindet auch in der anderen App.' : ''}`)) return;
    removeRecipe(el.dataset.id);
    closeSheet();
    rerender();
  },
  'rc-add-item'() {
    document.getElementById('rc-items').insertAdjacentHTML('beforeend', itemRow());
  },
  'rc-del-item'(el) {
    const box = document.getElementById('rc-items');
    if (box.children.length > 1) el.closest('.rc-item').remove();
    else { el.closest('.rc-item').querySelector('select').value = ''; el.closest('.rc-item').querySelector('input').value = ''; }
  },
  'rc-save-ing'() {
    addIngredient();
  },
  'shop-range'(el) {
    ui.shopFromToday = el.dataset.v === '1';
    rerender();
  },
  'reset-checks'() {
    resetChecks();
    rerender();
  },
  'del-custom'(el) {
    delCustomItem(el.dataset.key);
    rerender();
  },
};

export const foodChanges = {
  check(el) {
    setChecked(el.dataset.id, el.checked);
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
  'check-custom'(el) {
    setCustomDone(el.dataset.key, el.checked);
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
  'toggle-recipe'(el) {
    setOff(el.dataset.id, !el.checked);
    rerender();
  },
};

export function addCustom(form) {
  const name = form.item.value.trim();
  if (!name) return;
  addCustomItem(name);
  rerender();
  document.querySelector('[data-form="add-custom"] input')?.focus();
}
