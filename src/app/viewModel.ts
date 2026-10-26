// Turns core meals into the card shape the Today UI draws.
import { estCost, foodIndex, mealIndex, suppers } from "../core/content";
import { mealNutrition } from "../core/nutrition";
import { shortfall } from "../core/planner";
import { withRinse } from "../core/rinse";
import type { Meal as CoreMeal, Product, StockItem } from "../core/types";
import type { Meal as CardMeal } from "../data/meals";

export const foodMap = foodIndex;
export const mealMap = mealIndex;
export const supperMap = new Map(suppers.map((s) => [s.id, s]));

/** The prototype card for a meal. `stock` (optional) adds the "missing" list for near-miss cards. */
/** `rinse` is the set of food ids he has marked as needing a rinse. */
export function toCard(meal: CoreMeal, stock?: StockItem[], rinse?: Set<string>, products?: Map<string, Product>, leave: string[] = []): CardMeal {
  const n = mealNutrition(meal, foodMap, products, leave);
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
    steps: rinse && rinse.size && !meal.bought ? withRinse(meal.steps, meal.items.filter((i) => rinse.has(i.foodId)).map((i) => foodMap.get(i.foodId)?.name ?? "")) : meal.steps,
    boosters: meal.boosters,
    optional: meal.items.filter((i) => i.optional).map((i) => ({ name: foodMap.get(i.foodId)?.name ?? i.foodId, foodId: i.foodId, left: leave.includes(i.foodId) })),
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
