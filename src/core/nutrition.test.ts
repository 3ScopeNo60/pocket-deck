import { describe, expect, it } from "vitest";
import { maintenanceKcal, mealGrams, mealNutrition, targets } from "./nutrition";
import { FOODS, MEALS } from "./fixtures";
import type { Product, Profile } from "./types";

const adult: Profile = { heightCm: 180, weightKg: 85, age: 35, sex: "male", activity: "moderate", hand: "right", budgetPerWeek: 500, units: "kitchen" };

describe("nutrition", () => {
  it("uses Mifflin–St Jeor with the activity factor", () => {
    expect(maintenanceKcal(adult)).toBe(2798);
    expect(maintenanceKcal({ ...adult, sex: "female", weightKg: 65, heightCm: 165, age: 40, activity: "sedentary" })).toBe(1584);
  });

  it("derives targets, rounding the saturated-fat cap to 0.5 g", () => {
    const t = targets(adult);
    expect(t.satCap).toBe(18.5); // 0.06 × 2798 / 9 = 18.65
    expect(t).toMatchObject({ sodiumMax: 2000, solMin: 10, betaGlucanMin: 3, nutsG: 30 });
  });

  it("sums a meal from measures", () => {
    const n = mealNutrition(MEALS[0], FOODS); // 40 g oats + 183 g milk
    expect(n.sat).toBeCloseTo(0.4 * 1.1 + 1.83 * 1.3, 5);
    expect(n.betaGlucan).toBeCloseTo(1.6, 5);
    expect(mealGrams(MEALS[0], FOODS)).toEqual({ oats: 40, milk: 183 });
  });

  it("lets a scanned product override the generic food, field by field", () => {
    const product: Product = { id: "p1", foodId: "milk", name: "Brand milk", per100: { sat: 0.1, na: 40, kcal: 35 }, packG: 1000, lastPrice: 24, estimated: [] };
    const generic = mealNutrition(MEALS[0], FOODS);
    const branded = mealNutrition(MEALS[0], FOODS, new Map([["milk", product]]));
    expect(branded.sat).toBeLessThan(generic.sat);
    expect(branded.sol).toBeCloseTo(generic.sol, 5); // product didn't print sol, food's value is kept
  });

  it("returns a bought meal's own figures and throws on an unknown measure", () => {
    const bought = MEALS.find((m) => m.bought)!;
    expect(mealNutrition(bought, FOODS).na).toBe(950);
    const bad = { ...MEALS[0], items: [{ foodId: "oats", measure: "a bucket" }] };
    expect(() => mealNutrition(bad, FOODS)).toThrow(/a bucket/);
    expect(() => mealGrams(bad, FOODS)).toThrow();
  });
});
