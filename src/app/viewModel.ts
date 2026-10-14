// Turns core meals into the card shape the Today UI draws.
import { estCost, foods, mealIndex, suppers } from "../core/content";
import { mealNutrition } from "../core/nutrition";
import { shortfall } from "../core/planner";
import type { Meal as CoreMeal, StockItem } from "../core/types";
import type { Meal as CardMeal } from "../data/meals";

export const foodMap = new Map(foods.map((f) => [f.id, f]));
export const mealMap = mealIndex;
export const supperMap = new Map(suppers.map((s) => [s.id, s]));

/** The prototype card for a meal. `stock` (optional) adds the "missing" list for near-miss cards. */
export function toCard(meal: CoreMeal, stock?: StockItem[]): CardMeal {
  const n = mealNutrition(meal, foodMap);
  const items: CardMeal["items"] = meal.bought
    ? [[meal.emoji, meal.bought.where, "1"], ...(meal.bought.orderNotes ?? []).map((t): [string, string, string] => ["📝", t, ""])]
    : meal.items.map((i): [string, string, string] => [foodMap.get(i.foodId)?.emoji ?? "🍽️", foodMap.get(i.foodId)?.name ?? i.foodId, i.measure]);
  const missing = stock && !meal.bought ? shortfall(meal, stock, {}, foodMap).map((s) => foodMap.get(s.foodId)?.name ?? s.foodId) : undefined;
  return {
    id: meal.id,
    icon: meal.emoji,
    name: meal.name,
    items,
    tags: meal.tags,
    steps: meal.steps,
    boosters: meal.boosters,
    bought: !!meal.bought,
    sat: round1(n.sat),
    na: Math.round(n.na),
    sol: round1(n.sol),
    kcal: Math.round(n.kcal),
    cost: Math.round(meal.bought ? meal.bought.price : estCost.get(meal.id) ?? 0),
    missing,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
