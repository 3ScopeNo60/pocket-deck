import { startingMealIds } from "../core/content";
import type { Prefs, Profile, StockItem } from "../core/types";

/**
 * Placeholder profile until Setup exists: only used to size the daily saturated-fat cap.
 * These are NOT the user's measurements.
 */
export const DEFAULT_PROFILE: Profile = {
  heightCm: 175, weightKg: 80, age: 40, sex: "male", activity: "moderate",
  hand: "right", budgetPerWeek: 500, units: "kitchen",
};

/** the user's own meals start out kept; the rest of the library waits for the setup swipe. */
export function defaultPrefs(): Prefs {
  return {
    flavours: [],
    foods: {},
    meals: Object.fromEntries(startingMealIds.map((id) => [id, { state: "kept" as const }])),
    firstTriedAt: {},
  };
}

/**
 * A starter pantry so the planner has something to work with until the Kitchen screen
 * lets the user enter what he really has. Grams of each food id. It stocks the ingredients of
 * his own meals, and deliberately leaves some suggestions short so "meals to unlock" shows.
 */
const STARTER: Record<string, number> = {
  "rolled-oats": 500, "milk-lowfat": 2000, blueberries: 250, almonds: 150, walnuts: 100,
  egg: 600, "wholewheat-bread": 700, tomato: 500, "chicken-thigh": 500, greens: 200,
  cucumber: 300, "tuna-water": 240, chickpeas: 480, "red-pepper": 300, "brown-rice": 1000,
  hummus: 250, "wholewheat-wrap": 270, carrot: 500, spinach: 150, "black-beans": 480,
  sweetcorn: 240, salsa: 300, apple: 1000, orange: 600, "olive-oil": 500, "lemon-juice": 100,
  psyllium: 200, "barley-cooked": 600, banana: 500, "berries-frozen": 500,
  "almond-milk": 1000, chia: 200, "rye-bread": 600, "peanut-butter": 400, avocado: 400,
};

export function starterStock(now = new Date()): StockItem[] {
  return Object.entries(STARTER)
    .filter(([, g]) => g > 0)
    .map(([itemId, grams]) => ({ itemId, kind: "food" as const, grams, updatedAt: now.toISOString() }));
}
