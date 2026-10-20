// Ernährung: Wochenplan, Rezepte und Einkaufsliste
import { state, save } from '../store.js';
import { getRecipe } from '../data/food.js';
import {
  targets, recipeMacros, dayMeals, dayMacros, ensurePlan, generatePlan, swapMeal, shoppingList, scaledItems,
} from '../nutrition.js';
import { ui, esc, n0, todayIdx, WEEKDAYS, WEEK_ORDER, openSheet, rerender } from '../ui.js';

export function viewFood() {
  const tabs = `
    <div class="daytabs">
      <button class="${ui.foodTab === 'plan' ? 'on' : ''}" data-action="food-tab" data-v="plan">🥗 Wochenplan</button>
      <button class="${ui.foodTab === 'shop' ? 'on' : ''}" data-action="food-tab" data-v="shop">🛒 Einkaufsliste</button>
    </div>`;
  return tabs + (ui.foodTab === 'shop' ? shopping() : plan());
}

function plan() {
  const p = ensurePlan();
  const t = targets();
  const d = ui.foodDay;
  const day = p.days[d];
  const m = dayMacros(day);

  const tabs = WEEK_ORDER.map((wd, i) => `<button class="${i === d ? 'on' : ''} ${i === todayIdx() ? 'today' : ''}" data-action="food-day" data-idx="${i}">${WEEKDAYS[wd]}</button>`).join('');

  const meals = dayMeals(day).map((meal) => {
    const r = getRecipe(meal.id);
    const mm = recipeMacros(r, day.scale);
    return `<div class="row">
      <button class="grow plain" data-action="recipe" data-day="${d}" data-id="${r.id}">
        <div class="small muted">${meal.label} · ${r.time} Min</div><div>${esc(r.name)}</div>
        <div class="small muted">${n0(mm.kcal)} kcal · ${n0(mm.p)} g Eiweiß</div></button>
      <button class="btn ghost" data-action="swap" data-day="${d}" data-slot="${meal.slot}" data-index="${meal.index ?? 0}" aria-label="Gericht tauschen">🔄</button>
    </div>`;
  }).join('');

  return `
    <div class="daytabs small-tabs">${tabs}</div>
    <div class="card">
      <div class="flex between"><b>${n0(m.kcal)} kcal</b><span class="muted small">Ziel ${n0(t.kcal)} kcal · ${t.protein} g Eiweiß</span></div>
      <div class="macros">
        <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
        <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
        <div><b>${n0(m.f)} g</b><span>Fett</span></div>
        <div><b>×${day.scale.toLocaleString('de-DE')}</b><span>Portion</span></div>
      </div>
    </div>
    <div class="list">${meals}</div>
    <p class="small muted">Die Portionsgrößen werden automatisch an dein Kalorienziel angepasst. Mit 🔄 tauschst du ein Gericht aus.</p>
    <button class="btn secondary block" data-action="new-plan">Neuen Wochenplan erstellen</button>`;
}

function shopping() {
  const p = ensurePlan();
  if (state.shopping.weekStart !== p.weekStart) {
    state.shopping.weekStart = p.weekStart;
    state.shopping.checked = {};
    save();
  }
  const groups = shoppingList(ui.shopFromToday ? todayIdx() : 0);
  const checked = state.shopping.checked;

  const list = groups.map((g) => `
    <h2>${g.cat}</h2>
    <div class="list">${g.items.map((i) => `
      <label class="check-row ${checked[i.id] ? 'checked' : ''}">
        <input type="checkbox" data-action="check" data-id="${i.id}" ${checked[i.id] ? 'checked' : ''}>
        <span class="grow name">${esc(i.name)}</span><span class="amount">${i.amount}</span></label>`).join('')}</div>`).join('');

  const custom = state.shopping.custom.map((c, i) => `
    <div class="check-row ${c.done ? 'checked' : ''}">
      <input type="checkbox" data-action="check-custom" data-idx="${i}" ${c.done ? 'checked' : ''}>
      <span class="grow name">${esc(c.name)}</span>
      <button class="btn ghost small" data-action="del-custom" data-idx="${i}" aria-label="Löschen">✕</button></div>`).join('');

  return `
    <div class="daytabs small-tabs">
      <button class="${ui.shopFromToday ? '' : 'on'}" data-action="shop-range" data-v="0">Ganze Woche</button>
      <button class="${ui.shopFromToday ? 'on' : ''}" data-action="shop-range" data-v="1">Ab heute</button>
    </div>
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

function showRecipe(dayIdx, id) {
  const p = ensurePlan();
  const scale = p.days[dayIdx]?.scale ?? 1;
  const r = getRecipe(id);
  const m = recipeMacros(r, scale);
  openSheet(`
    <h3>${esc(r.name)}</h3>
    <div class="small muted">${r.time} Min${r.veg ? ' · vegetarisch' : ''} · 1 Portion (×${scale.toLocaleString('de-DE')})</div>
    <div class="card macros" style="margin-top:12px">
      <div><b>${n0(m.kcal)}</b><span>kcal</span></div>
      <div><b>${n0(m.p)} g</b><span>Eiweiß</span></div>
      <div><b>${n0(m.c)} g</b><span>Kohlenh.</span></div>
      <div><b>${n0(m.f)} g</b><span>Fett</span></div>
    </div>
    <h2>Zutaten</h2>
    <div class="list">${scaledItems(r, scale).map((i) => `<div class="row"><div class="grow">${esc(i.name)}</div><div class="muted small">${i.amount}</div></div>`).join('')}</div>
    <p class="small muted">Salz, Pfeffer und Gewürze nach Geschmack.</p>
    <h2>Zubereitung</h2>
    <div class="card"><ol style="margin:0;padding-left:20px">${r.steps.map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join('')}</ol></div>
    <button class="btn block" data-action="close-sheet">Schließen</button>`);
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
    swapMeal(Number(el.dataset.day), el.dataset.slot, Number(el.dataset.index));
    rerender();
  },
  'new-plan'() {
    if (!confirm('Neuen Wochenplan mit anderen Gerichten erstellen?')) return;
    generatePlan();
    rerender();
  },
  'shop-range'(el) {
    ui.shopFromToday = el.dataset.v === '1';
    rerender();
  },
  'reset-checks'() {
    state.shopping.checked = {};
    state.shopping.custom = state.shopping.custom.filter((c) => !c.done);
    save();
    rerender();
  },
  'del-custom'(el) {
    state.shopping.custom.splice(Number(el.dataset.idx), 1);
    save();
    rerender();
  },
};

export const foodChanges = {
  check(el) {
    state.shopping.checked[el.dataset.id] = el.checked;
    save();
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
  'check-custom'(el) {
    state.shopping.custom[Number(el.dataset.idx)].done = el.checked;
    save();
    el.closest('.check-row').classList.toggle('checked', el.checked);
  },
};

export function addCustom(form) {
  const name = form.item.value.trim();
  if (!name) return;
  state.shopping.custom.push({ name, done: false });
  save();
  rerender();
  document.querySelector('[data-form="add-custom"] input')?.focus();
}
