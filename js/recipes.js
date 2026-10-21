// Eigene Rezepte und Zutaten, Rezepte an- und abwählen.
// Ist ein gemeinsamer Plan verbunden, gelten die Rezepte dort (beide Apps sehen sie);
// eine Kopie bleibt lokal, damit nach dem Trennen nichts verloren geht.
import { CUSTOM } from './data/food.js';
import { state, save } from './store.js';
import { isLinked, remoteCustom, putRecipe, deleteRecipe, putIngredient, publishMember, othersOff, randomCode } from './sync.js';

export function refreshCustom() {
  const shared = isLinked() ? remoteCustom() : undefined;
  if (shared) {
    const recipes = shared.recipes.map((r) => ({ ...r, steps: r.steps || [], items: r.items || {} }));
    if (JSON.stringify(recipes) !== JSON.stringify(state.customRecipes) || JSON.stringify(shared.ingredients) !== JSON.stringify(state.customIngredients)) {
      state.customRecipes = recipes;
      state.customIngredients = { ...shared.ingredients };
      save();
    }
  }
  CUSTOM.recipes = state.customRecipes || [];
  CUSTOM.ingredients = state.customIngredients || {};
}

export function isCustom(id) {
  return (state.customRecipes || []).some((r) => r.id === id);
}

export function saveRecipe(recipe) {
  const r = { ...recipe, id: recipe.id || `c-${randomCode(8)}` };
  const list = state.customRecipes || [];
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) list[i] = r;
  else list.push(r);
  state.customRecipes = list;
  save();
  putRecipe(r);
  refreshCustom();
  return r;
}

export function removeRecipe(id) {
  state.customRecipes = (state.customRecipes || []).filter((r) => r.id !== id);
  state.recipeOff = (state.recipeOff || []).filter((x) => x !== id);
  save();
  deleteRecipe(id);
  refreshCustom();
}

export function saveIngredient(ing) {
  const id = `ci-${randomCode(8)}`;
  const item = { ...ing, id };
  state.customIngredients = { ...(state.customIngredients || {}), [id]: item };
  save();
  putIngredient(item);
  refreshCustom();
  return item;
}

/* ---------- An/Aus ---------- */

export function isOff(id) {
  return (state.recipeOff || []).includes(id);
}

export function setOff(id, off) {
  const set = new Set(state.recipeOff || []);
  if (off) set.add(id);
  else set.delete(id);
  state.recipeOff = [...set];
  save();
  publishMember();
}

// Abgewählt von mir oder (im gemeinsamen Plan) von der anderen Person
export function blockedRecipes() {
  return new Set([...(state.recipeOff || []), ...(isLinked() ? othersOff() : [])]);
}
