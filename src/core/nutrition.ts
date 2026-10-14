import type { Profile, Food, Product, Meal, Per100 } from "./types";

const ACTIVITY_FACTORS: Record<Profile["activity"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

export function maintenanceKcal(profile: Profile): number {
  const { weightKg, heightCm, age, sex, activity } = profile;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

export interface Targets {
  kcal: number;
  satCap: number;
  sodiumMax: number;
  solMin: number;
  betaGlucanMin: number;
  nutsG: number;
}

export function targets(profile: Profile): Targets {
  const kcal = maintenanceKcal(profile);
  const satCap = Math.round((0.06 * kcal / 9) * 2) / 2;
  return {
    kcal,
    satCap,
    sodiumMax: 2000,
    solMin: 10,
    betaGlucanMin: 3,
    nutsG: 30,
  };
}

function getPer100(food: Food, product: Product | undefined): Per100 {
  if (product) {
    return {
      kcal: product.per100.kcal ?? food.per100.kcal,
      sat: product.per100.sat ?? food.per100.sat,
      mono: product.per100.mono ?? food.per100.mono,
      poly: product.per100.poly ?? food.per100.poly,
      na: product.per100.na ?? food.per100.na,
      fibre: product.per100.fibre ?? food.per100.fibre,
      sol: product.per100.sol ?? food.per100.sol,
      betaGlucan: product.per100.betaGlucan ?? food.per100.betaGlucan,
    };
  }
  return food.per100;
}

export function mealNutrition(
  meal: Meal,
  foods: Map<string, Food>,
  products: Map<string, Product> = new Map()
): Per100 {
  if (meal.bought) {
    return meal.bought.per;
  }
  const total: Per100 = {
    kcal: 0,
    sat: 0,
    mono: 0,
    poly: 0,
    na: 0,
    fibre: 0,
    sol: 0,
    betaGlucan: 0,
  };
  for (const item of meal.items) {
    const food = foods.get(item.foodId);
    if (!food) continue;
    const grams = food.measures[item.measure];
    if (grams === undefined) {
      throw new Error(`Unknown measure "${item.measure}" for food ${food.name}`);
    }
    const product = products.get(item.foodId);
    const per100 = getPer100(food, product);
    const factor = grams / 100;
    total.kcal += per100.kcal * factor;
    total.sat += per100.sat * factor;
    total.mono += per100.mono * factor;
    total.poly += per100.poly * factor;
    total.na += per100.na * factor;
    total.fibre += per100.fibre * factor;
    total.sol += per100.sol * factor;
    total.betaGlucan += per100.betaGlucan * factor;
  }
  return total;
}

export function mealGrams(meal: Meal, foods: Map<string, Food>): Record<string, number> {
  const grams: Record<string, number> = {};
  for (const item of meal.items) {
    const food = foods.get(item.foodId);
    if (!food) continue;
    const g = food.measures[item.measure];
    if (g === undefined) {
      throw new Error(`Unknown measure "${item.measure}" for food ${food.name}`);
    }
    grams[item.foodId] = (grams[item.foodId] ?? 0) + g;
  }
  return grams;
}