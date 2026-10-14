// New meals arrive with app updates. Each is held back ("new") until the user decides, so an
// update never changes tonight's plan on its own. Pure logic, with tests.
import type { Prefs } from "./types";

export interface Discovery {
  prefs: Prefs;
  /** Meals that appeared since last time and now wait for a decision. */
  added: string[];
}

/**
 * Compare the meals this build ships with the ones already shown. The first time (no record yet)
 * everything shipped counts as seen, so only *future* additions are announced.
 */
export function discoverMeals(shippedIds: string[], prefs: Prefs): Discovery {
  if (!prefs.seenMeals) return { prefs: { ...prefs, seenMeals: [...shippedIds] }, added: [] };
  const seen = new Set(prefs.seenMeals);
  const added = shippedIds.filter((id) => !seen.has(id) && !prefs.meals[id]);
  if (!added.length && shippedIds.every((id) => seen.has(id))) return { prefs, added: [] };
  const meals = { ...prefs.meals };
  for (const id of added) meals[id] = { state: "new" };
  return { prefs: { ...prefs, meals, seenMeals: [...new Set([...prefs.seenMeals, ...shippedIds])] }, added };
}

/** Meals waiting for a decision, in shipped order, ignoring any that were since removed. */
export function pendingMeals(shippedIds: string[], prefs: Prefs): string[] {
  return shippedIds.filter((id) => prefs.meals[id]?.state === "new");
}

/** Keep one pending meal in the rotation, or put it away. Meals not pending are left alone. */
export function decideMeal(prefs: Prefs, id: string, keep: boolean): Prefs {
  if (prefs.meals[id]?.state !== "new") return prefs;
  return { ...prefs, meals: { ...prefs.meals, [id]: { state: keep ? "kept" : "hidden" } } };
}
