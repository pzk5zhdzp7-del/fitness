import { INGREDIENTS, RECIPES, CATEGORIES, getRecipe } from './data/food.js';
import { state, save } from './store.js';
import { startOfWeek } from './training.js';
import { isLinked, remotePlan, sharePlan, members, publishMember } from './sync.js';

export const GOALS = {
  lose: { label: 'Abnehmen', delta: -400 },
  maintain: { label: 'Gewicht halten', delta: 0 },
  gain: { label: 'Muskelaufbau', delta: 250 },
};

export const ACTIVITY = [
  { value: 1.375, label: 'Bürojob + 3× Training' },
  { value: 1.55, label: 'Etwas Bewegung im Alltag + 3× Training' },
  { value: 1.725, label: 'Körperlich aktiver Job + Training' },
];

// Grundumsatz nach Mifflin-St Jeor × Aktivitätsfaktor
export function targets(profile = state.profile) {
  const { sex, age, height, weight, activity, goal, proteinPerKg } = profile;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5);
  const kcal = Math.round((bmr * activity + GOALS[goal].delta) / 10) * 10;
  const protein = Math.round(weight * proteinPerKg);
  return { kcal, protein };
}

export function recipeMacros(recipe, scale = 1) {
  const m = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const [id, grams] of Object.entries(recipe.items)) {
    const ing = INGREDIENTS[id];
    const g = (grams * scale) / 100;
    m.kcal += ing.kcal * g;
    m.p += ing.p * g;
    m.c += ing.c * g;
    m.f += ing.f * g;
  }
  return m;
}

export function dayMeals(day) {
  return [
    { slot: 'breakfast', label: 'Frühstück', id: day.breakfast },
    { slot: 'lunch', label: 'Mittag', id: day.lunch },
    { slot: 'dinner', label: 'Abend', id: day.dinner },
    ...day.snacks.map((id, i) => ({ slot: 'snack', index: i, label: 'Snack', id })),
  ];
}

export function dayMacros(day) {
  const total = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const meal of dayMeals(day)) {
    const m = recipeMacros(getRecipe(meal.id), day.scale);
    total.kcal += m.kcal;
    total.p += m.p;
    total.c += m.c;
    total.f += m.f;
  }
  return total;
}

function pool(slot) {
  const s = slot === 'lunch' || slot === 'dinner' ? 'main' : slot;
  return RECIPES.filter((r) => r.slot === s && (!state.profile.vegetarian || r.veg));
}

// Wählt das am seltensten genutzte Rezept (Zufall bei Gleichstand)
function pick(slot, used, exclude = []) {
  let options = pool(slot).filter((r) => !exclude.includes(r.id));
  if (!options.length) options = pool(slot);
  const min = Math.min(...options.map((r) => used[r.id] || 0));
  const best = options.filter((r) => (used[r.id] || 0) === min);
  const choice = best[Math.floor(Math.random() * best.length)];
  used[choice.id] = (used[choice.id] || 0) + 1;
  return choice.id;
}

// Portionsfaktor, damit der Tag zum Kalorienziel passt
export function scaleFor(day, kcalTarget) {
  const base = dayMacros({ ...day, scale: 1 }).kcal;
  return Math.round(Math.max(0.7, Math.min(1.6, kcalTarget / base)) * 20) / 20;
}

function fitScale(day, kcalTarget) {
  day.scale = scaleFor(day, kcalTarget);
}

export function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function generatePlan({ share = true } = {}) {
  const { kcal } = targets();
  const used = {};
  const days = [];
  let prev = null;
  for (let i = 0; i < 7; i++) {
    const breakfast = pick('breakfast', used, prev ? [prev.breakfast] : []);
    let lunch;
    if (state.profile.leftovers && prev) {
      lunch = prev.dinner;
    } else {
      lunch = pick('lunch', used, prev ? [prev.lunch, prev.dinner] : []);
    }
    const dinner = pick('dinner', used, [lunch, ...(prev ? [prev.dinner] : [])]);
    const day = { breakfast, lunch, dinner, snacks: [], scale: 1 };
    day.snacks.push(pick('snack', used, prev ? prev.snacks : []));
    // Bei hohem Bedarf zweiter Snack statt riesiger Portionen
    if (kcal / dayMacros(day).kcal > 1.35) day.snacks.push(pick('snack', used, day.snacks));
    fitScale(day, kcal);
    days.push(day);
    prev = day;
  }
  state.mealPlan = { weekStart: isoDate(startOfWeek(new Date())), kcal, days };
  save();
  if (share) sharePlan(state.mealPlan);
  return state.mealPlan;
}

// Gemeinsamen Plan übernehmen, Portionen nach dem eigenen Kalorienziel
function adoptPlan(shared) {
  const { kcal } = targets();
  const ids = (p) => JSON.stringify(p.days.map((d) => [d.breakfast, d.lunch, d.dinner, d.snacks]));
  const cur = state.mealPlan;
  if (cur && cur.weekStart === shared.weekStart && cur.kcal === kcal && ids(cur) === ids(shared)) return cur;
  state.mealPlan = {
    weekStart: shared.weekStart,
    kcal,
    by: shared.by,
    days: shared.days.map((d) => {
      const day = { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner, snacks: [...d.snacks], scale: 1 };
      fitScale(day, kcal);
      return day;
    }),
  };
  save();
  return state.mealPlan;
}

export function ensurePlan() {
  const week = isoDate(startOfWeek(new Date()));
  if (isLinked()) {
    publishMember(targets().kcal);
    const shared = remotePlan();
    if (shared && shared.weekStart === week && shared.days.every((d) => [d.breakfast, d.lunch, d.dinner, ...d.snacks].every(getRecipe))) {
      return adoptPlan(shared);
    }
    // Gemeinsamer Stand noch nicht geladen: vorerst lokal planen, aber nichts überschreiben
    if (shared === undefined) {
      if (!state.mealPlan || state.mealPlan.weekStart !== week) generatePlan({ share: false });
      return state.mealPlan;
    }
    return generatePlan();
  }
  if (!state.mealPlan || state.mealPlan.weekStart !== week) generatePlan();
  return state.mealPlan;
}

// Kalorienziele aller Personen, für die eingekauft wird
export function peopleKcal() {
  const own = targets().kcal;
  if (!isLinked()) return [own];
  const ms = members();
  const list = ms.map((m) => (m.me ? own : m.kcal || own));
  if (!ms.some((m) => m.me)) list.push(own);
  return list;
}

export function swapMeal(dayIdx, slot, index = 0) {
  const day = state.mealPlan.days[dayIdx];
  const current = slot === 'snack' ? day.snacks[index] : day[slot];
  const id = pick(slot, {}, [current, day.lunch, day.dinner]);
  if (slot === 'snack') day.snacks[index] = id;
  else day[slot] = id;
  fitScale(day, state.mealPlan.kcal);
  save();
  sharePlan(state.mealPlan);
}

// Einkaufsliste: Summe aller Zutaten der Woche, nach Abteilung sortiert
export function shoppingList(fromDay = 0) {
  const plan = ensurePlan();
  const people = peopleKcal();
  const totals = {};
  plan.days.slice(fromDay).forEach((day) => {
    // Bei gemeinsamem Plan: Portionen aller Personen zusammenrechnen
    const scale = people.length > 1 ? people.reduce((a, k) => a + scaleFor(day, k), 0) : day.scale;
    for (const meal of dayMeals(day)) {
      for (const [id, g] of Object.entries(getRecipe(meal.id).items)) {
        totals[id] = (totals[id] || 0) + g * scale;
      }
    }
  });
  const groups = CATEGORIES.map((cat) => ({ cat, items: [] }));
  for (const [id, grams] of Object.entries(totals)) {
    const ing = INGREDIENTS[id];
    groups.find((g) => g.cat === ing.cat).items.push({ id, name: ing.name, amount: formatAmount(ing, grams) });
  }
  groups.forEach((g) => g.items.sort((a, b) => a.name.localeCompare(b.name, 'de')));
  return groups.filter((g) => g.items.length);
}

function formatAmount(ing, grams) {
  if (ing.piece) {
    const n = Math.ceil(grams / ing.piece - 0.15);
    return `${Math.max(1, n)} ${ing.pieceName || 'Stk'}`;
  }
  const unit = ing.unit || 'g';
  const rounded = Math.ceil(grams / 10) * 10;
  if (rounded >= 1000) return `${(rounded / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${unit === 'ml' ? 'l' : 'kg'}`;
  return `${rounded} ${unit}`;
}

export function scaledItems(recipe, scale) {
  return Object.entries(recipe.items).map(([id, g]) => {
    const ing = INGREDIENTS[id];
    const grams = Math.round((g * scale) / 5) * 5;
    let amount = `${grams} ${ing.unit || 'g'}`;
    if (ing.piece) {
      const n = Math.round((g * scale) / ing.piece * 2) / 2;
      amount = `${n.toLocaleString('de-DE')} ${ing.pieceName || 'Stk'} (${grams} g)`;
    }
    return { name: ing.name, amount };
  });
}
