// The full list of nutrient markers, for a meal or a whole day. Each total says whether every
// ingredient had a number for it: a food list gap makes the total a floor ("12 g+"), and a
// nutrient nothing has a number for is "not known" rather than zero.
import { replacedNutrition, extraNutrition } from "./offplan";
import type { Day, Food, Meal, Per100, Product } from "./types";

export type NKey = "kcal" | "protein" | "carbs" | "sugar" | "fat" | "sat" | "mono" | "poly" | "chol" | "fibre" | "sol" | "betaGlucan" | "na" | "sterols";

export interface NutrientInfo { key: NKey; label: string; unit: "kcal" | "g" | "mg"; group: string; sub?: boolean }

/** In the order they're shown. `sub` rows are "of which" lines. */
export const NUTRIENTS: NutrientInfo[] = [
  { key: "kcal", label: "Energy", unit: "kcal", group: "Energy and macros" },
  { key: "protein", label: "Protein", unit: "g", group: "Energy and macros" },
  { key: "carbs", label: "Carbohydrate", unit: "g", group: "Energy and macros" },
  { key: "sugar", label: "of which total sugar", unit: "g", group: "Energy and macros", sub: true },
  { key: "fat", label: "Total fat", unit: "g", group: "Fats and cholesterol" },
  { key: "sat", label: "of which saturated", unit: "g", group: "Fats and cholesterol", sub: true },
  { key: "mono", label: "of which monounsaturated", unit: "g", group: "Fats and cholesterol", sub: true },
  { key: "poly", label: "of which polyunsaturated", unit: "g", group: "Fats and cholesterol", sub: true },
  { key: "chol", label: "Cholesterol", unit: "mg", group: "Fats and cholesterol" },
  { key: "sterols", label: "Plant sterols", unit: "mg", group: "Fats and cholesterol" },
  { key: "fibre", label: "Total fibre", unit: "g", group: "Fibre" },
  { key: "sol", label: "Soluble fibre", unit: "g", group: "Fibre", sub: true },
  { key: "betaGlucan", label: "Beta-glucan", unit: "g", group: "Fibre", sub: true },
  { key: "na", label: "Sodium", unit: "mg", group: "Salt" },
];
export const NKEYS = NUTRIENTS.map((n) => n.key);

export interface Totals {
  values: Record<NKey, number>;
  /** At least one ingredient had a number for it. */
  known: Record<NKey, boolean>;
  /** Some ingredient had no number for it, so the total is at least this much. */
  partial: Record<NKey, boolean>;
}

const empty = (): Totals => ({
  values: Object.fromEntries(NKEYS.map((k) => [k, 0])) as Record<NKey, number>,
  known: Object.fromEntries(NKEYS.map((k) => [k, false])) as Record<NKey, boolean>,
  partial: Object.fromEntries(NKEYS.map((k) => [k, false])) as Record<NKey, boolean>,
});

/** A food's per-100 g numbers, with those read from a pack he scanned laid over the top. */
export function effectivePer100(food: Food, product?: Product): Partial<Record<NKey, number>> {
  const base = food.per100 as Partial<Record<NKey, number>>;
  if (!product) return { ...base };
  const over = product.per100 as Partial<Record<NKey, number>>;
  const out = { ...base };
  for (const k of NKEYS) if (over[k] !== undefined) out[k] = over[k];
  return out;
}

/** The food list with scanned-pack numbers in place, for anything that scores or shows nutrition. */
export function withProducts(foods: Map<string, Food>, products: Map<string, Product>): Map<string, Food> {
  if (products.size === 0) return foods;
  const out = new Map(foods);
  for (const [id, p] of products) {
    const f = foods.get(id);
    if (f) out.set(id, { ...f, per100: { ...f.per100, ...(p.per100 as Partial<Per100>) } as Per100 });
  }
  return out;
}

/** A meal's totals. A bought meal only has what its entry lists. */
export function mealTotals(meal: Meal, foods: Map<string, Food>, products: Map<string, Product> = new Map()): Totals {
  const t = empty();
  if (meal.bought) {
    const per = meal.bought.per as unknown as Partial<Record<NKey, number>>;
    for (const k of NKEYS) {
      if (per[k] !== undefined) { t.values[k] = per[k]!; t.known[k] = true; } else t.partial[k] = true;
    }
    return t;
  }
  for (const item of meal.items) {
    const food = foods.get(item.foodId);
    const grams = food?.measures[item.measure];
    if (!food || grams === undefined) continue;
    const p = effectivePer100(food, products.get(item.foodId));
    for (const k of NKEYS) {
      const v = p[k];
      if (v === undefined) { t.partial[k] = true; continue; }
      t.values[k] += (v * grams) / 100;
      t.known[k] = true;
    }
  }
  return t;
}

export interface DayExtras {
  /** Supper's saturated fat, sodium and energy where it's recorded. */
  supper?: { sat: number; na: number } | null;
}

/**
 * A day's totals from what was ticked off, plus anything swapped in or added (counted for saturated
 * fat and sodium only) and supper (the same). Everything else is then at least what the meals gave.
 */
export function dayTotals(day: Day, meals: Map<string, Meal>, foods: Map<string, Food>, products: Map<string, Product> = new Map(), extras: DayExtras = {}): Totals {
  const t = empty();
  const add = (m: Totals) => {
    for (const k of NKEYS) {
      t.values[k] += m.values[k];
      t.known[k] = t.known[k] || m.known[k];
      t.partial[k] = t.partial[k] || m.partial[k];
    }
  };
  for (const e of day.eaten) {
    const meal = meals.get(e.mealId);
    if (meal) add(mealTotals(meal, foods, products));
  }
  const rough: { sat: number; na: number }[] = [
    ...(day.replaced ?? []).map((r) => replacedNutrition(r)),
    ...(day.extras ?? []).map((x) => extraNutrition(x)),
    ...(extras.supper ? [extras.supper] : []),
  ];
  for (const r of rough) {
    t.values.sat += r.sat; t.values.na += r.na;
    t.known.sat = t.known.na = true;
    for (const k of NKEYS) if (k !== "sat" && k !== "na") t.partial[k] = true;
  }
  return t;
}

const round = (n: number, unit: NutrientInfo["unit"]) => (unit === "kcal" ? Math.round(n / 5) * 5 : unit === "mg" ? (n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)) : Math.round(n * 10) / 10);

/** "≈ 12.4 g", "≈ 12.4 g+" when some ingredient had no number, "not known" when none did. */
export function showValue(t: Totals, k: NKey): string {
  const info = NUTRIENTS.find((n) => n.key === k)!;
  if (!t.known[k]) return "not known";
  return `≈ ${round(t.values[k], info.unit)} ${info.unit}${t.partial[k] ? "+" : ""}`;
}
