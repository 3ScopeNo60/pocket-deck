// Loads the shipped content (src/content/*.json) as core types.
// The JSON is written to be easy to author: meal items are [foodId, measure] pairs.
import foodsJson from "../content/foods.json";
import mealsJson from "../content/meals.json";
import suppersJson from "../content/suppers.json";
import type { Food, Meal, Per100 } from "./types";

export interface SupperOption {
  id: string;
  group: "Home" | "Takeaway";
  emoji: string;
  name: string;
  /** Saturated fat (g), sodium (mg) and energy for a normal plate. */
  sat: number;
  na: number;
  kcal: number;
}

interface RawMeal {
  id: string;
  slot: Meal["slot"];
  emoji: string;
  name: string;
  cuisine: string;
  mine?: boolean;
  items: [string, string][];
  tags: string[];
  keepsDays: number;
  prepGroup?: string;
  estCost?: number;
  steps: string[];
  boosters: string[];
  bought?: { where: string; price: number; per: Per100; orderNotes?: string[] };
}

export const foods: Food[] = (foodsJson.foods as unknown as Food[]).map((f) => ({ ...f }));
export const suppers: SupperOption[] = suppersJson.suppers as unknown as SupperOption[];

export const meals: Meal[] = (mealsJson.meals as unknown as RawMeal[]).map((m) => ({
  id: m.id,
  slot: m.slot,
  name: m.name,
  emoji: m.emoji,
  items: m.items.map(([foodId, measure]) => ({ foodId, measure })),
  steps: m.steps,
  boosters: m.boosters,
  tags: m.tags,
  cuisine: m.cuisine,
  bought: m.bought ? { where: m.bought.where, price: m.bought.price, per: m.bought.per, orderNotes: m.bought.orderNotes } : undefined,
  prepGroup: m.prepGroup,
  keepsDays: m.keepsDays,
}));

/** Meals the user already eats; they start out kept. */
export const startingMealIds: string[] = (mealsJson.meals as unknown as RawMeal[]).filter((m) => m.mine).map((m) => m.id);

/** Rough cost per serving until real prices are entered. */
export const estCost = new Map((mealsJson.meals as unknown as RawMeal[]).map((m) => [m.id, m.estCost ?? 0]));

/** Every meal by id, shipped and his own. Kept in step with `meals` by `addCustomMeal`. */
export const mealIndex = new Map(meals.map((m) => [m.id, m]));

/** Bring one of his own meals into the library (at load, or when he's just made one). */
export function addCustomMeal(m: Meal): void {
  if (mealIndex.has(m.id)) return;
  meals.push(m);
  mealIndex.set(m.id, m);
}
