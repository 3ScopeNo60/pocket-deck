// What Setup asks, and what it makes of the answers. Pure logic, with tests.
import type { Anchor, Food, Meal, Prefs } from "./types";

export type FoodAnswer = "like" | "try" | "no";

export const FLAVOURS = [
  { key: "spicy", label: "Spicy", emoji: "🌶️" },
  { key: "smoky", label: "Smoky", emoji: "🔥" },
  { key: "tangy", label: "Tangy & fresh", emoji: "🍋" },
  { key: "herby", label: "Herby", emoji: "🌿" },
  { key: "creamy", label: "Creamy & mild", emoji: "🥛" },
  { key: "warm", label: "Warm-spiced", emoji: "🫚" },
] as const;

/** Which flavours a cuisine leans towards. Used only to put likely favourites first. */
const CUISINE_FLAVOURS: Record<string, string[]> = {
  "Cape Malay": ["warm", "spicy"],
  Indian: ["warm", "spicy"],
  Mexican: ["smoky", "spicy", "tangy"],
  "Middle Eastern": ["tangy", "herby", "smoky"],
  Mediterranean: ["tangy", "herby"],
  Asian: ["spicy", "tangy"],
  "SA home": ["smoky", "warm"],
  Everyday: ["creamy"],
};

/** Foods worth asking about: anything a meal uses, anchor foods first, then the most-used. */
export function foodsToSwipe(foods: Food[], meals: Meal[], max = 40, skip: ReadonlySet<string> = new Set()): Food[] {
  const uses = new Map<string, number>();
  for (const m of meals) for (const i of m.items) uses.set(i.foodId, (uses.get(i.foodId) ?? 0) + 1);
  const isSeasoning = (f: Food) => f.per100.kcal > 0 && Math.max(...Object.values(f.measures)) <= 5 && f.packSizes.every((g) => g <= 100);
  return foods
    .filter((f) => uses.has(f.id) && !isSeasoning(f) && !skip.has(f.id))
    .sort((a, b) => Number(b.anchors.length > 0) - Number(a.anchors.length > 0) || (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, max);
}

/** Foods in the meals the user already eats start out liked: he eats them. */
export function startingFoodAnswers(meals: Meal[], mineIds: string[]): Record<string, FoodAnswer> {
  const out: Record<string, FoodAnswer> = {};
  for (const m of meals) if (mineIds.includes(m.id)) for (const i of m.items) out[i.foodId] = "like";
  return out;
}

/** Meals to ask about: not already his, nothing he said No to, likely favourites first. */
export function mealsToSwipe(meals: Meal[], answers: Record<string, FoodAnswer>, flavours: string[], mineIds: string[]): Meal[] {
  const fits = (m: Meal) => !m.items.some((i) => answers[i.foodId] === "no");
  const score = (m: Meal) => (CUISINE_FLAVOURS[m.cuisine] ?? []).filter((f) => flavours.includes(f)).length;
  return meals
    .filter((m) => !mineIds.includes(m.id) && fits(m))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => score(b.m) - score(a.m) || a.i - b.i)
    .map((x) => x.m);
}

export interface Gap {
  anchor: Anchor;
  /** Plain-words name of what's missing. */
  what: string;
  /** Easy ways in, as food ids the user hasn't ruled out. */
  routes: string[];
}

const ANCHOR_NAMES: Record<Anchor, string> = { betaGlucan: "oats or barley", legume: "beans, lentils or chickpeas", nuts: "nuts or seeds", goodFat: "olive oil, avocado or oily fish" };
const EASY_ROUTES: Record<Anchor, string[]> = {
  betaGlucan: ["oat-bran", "barley-cooked", "rolled-oats"],
  legume: ["hummus", "chickpeas", "baked-beans", "lentils"],
  nuts: ["peanut-butter", "almonds", "chia"],
  goodFat: ["olive-oil", "avocado", "canola-oil"],
};

/** Anchors with no food left that he hasn't said No to. */
export function anchorGaps(foods: Food[], answers: Record<string, FoodAnswer>): Gap[] {
  const gaps: Gap[] = [];
  for (const anchor of Object.keys(ANCHOR_NAMES) as Anchor[]) {
    const withAnchor = foods.filter((f) => f.anchors.includes(anchor));
    if (withAnchor.length && withAnchor.every((f) => answers[f.id] === "no")) {
      gaps.push({ anchor, what: ANCHOR_NAMES[anchor], routes: EASY_ROUTES[anchor].filter((id) => foods.some((f) => f.id === id)) });
    }
  }
  return gaps;
}

export interface SetupAnswers {
  flavours: string[];
  foods: Record<string, FoodAnswer>;
  keptMeals: string[];
  skippedMeals: string[];
}

/** Fold the answers into preferences. Skipped meals are hidden (and can be brought back in Kitchen). */
export function applySetup(prefs: Prefs, a: SetupAnswers): Prefs {
  const meals = { ...prefs.meals };
  for (const id of a.keptMeals) meals[id] = { ...meals[id], state: "kept" };
  for (const id of a.skippedMeals) meals[id] = { state: "hidden" };
  return { ...prefs, setupDone: true, flavours: a.flavours, foods: { ...prefs.foods, ...a.foods }, meals };
}
