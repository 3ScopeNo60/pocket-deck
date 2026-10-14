import type { Food, Meal, Prefs, StockItem } from "./types";

const per = (o: Partial<Food["per100"]> = {}): Food["per100"] => ({ kcal: 100, sat: 1, mono: 0, poly: 0, na: 10, fibre: 2, sol: 1, betaGlucan: 0, ...o });
const food = (id: string, over: Partial<Food> = {}): Food => ({
  id, name: id, emoji: "🍽️", per100: per(), measures: { "1": 100 }, keepsDays: 3, anchors: [], cuisines: [], packSizes: [500], source: "test", ...over,
});

export const FOODS = new Map<string, Food>([
  ["oats", food("oats", { per100: per({ sat: 1.1, sol: 4, betaGlucan: 4 }), measures: { "½ cup": 40 }, anchors: ["betaGlucan"] })],
  ["milk", food("milk", { per100: per({ sat: 1.3, sol: 0 }), measures: { "¾ cup": 183 } })],
  ["tuna", food("tuna", { per100: per({ sat: 0.2, na: 250, sol: 0 }), measures: { "1 tin": 120 }, packSizes: [120] })],
  ["beans", food("beans", { per100: per({ sat: 0.1, sol: 2.4 }), measures: { "½ cup": 120 }, anchors: ["legume"] })],
  ["feta", food("feta", { per100: per({ sat: 13, na: 1100, sol: 0 }), measures: { "2 tbsp": 20 } })],
  ["apple", food("apple", { per100: per({ sat: 0, sol: 0.6 }), measures: { "1": 182 } })],
]);

const meal = (id: string, slot: Meal["slot"], items: [string, string][], over: Partial<Meal> = {}): Meal => ({
  id, slot, name: id, emoji: "🍽️", items: items.map(([foodId, measure]) => ({ foodId, measure })),
  steps: [], boosters: [], tags: [], cuisine: "Everyday", keepsDays: 2, ...over,
});

export const MEALS: Meal[] = [
  meal("oats-bowl", "breakfast", [["oats", "½ cup"], ["milk", "¾ cup"]]),
  meal("apple", "snack", [["apple", "1"]]),
  meal("tuna-bowl", "lunch", [["tuna", "1 tin"], ["beans", "½ cup"]]),
  meal("feta-bowl", "lunch", [["beans", "½ cup"], ["feta", "2 tbsp"]]),
  meal("takeaway", "lunch", [], { bought: { where: "Kauai", price: 110, per: per({ sat: 3.8, na: 950, sol: 2.8 }) } }),
];

export const stock = (o: Record<string, number>): StockItem[] =>
  Object.entries(o).map(([itemId, grams]) => ({ itemId, kind: "food" as const, grams, updatedAt: "2026-10-14T08:00:00Z" }));

export const PREFS = (o: Partial<Prefs> = {}): Prefs => ({ flavours: [], foods: {}, meals: {}, firstTriedAt: {}, ...o });
