import { describe, expect, it } from "vitest";
import { foods, meals } from "./content";
import { blankDay } from "./backfill";
import { dayTotals, effectivePer100, mealTotals, showValue, withProducts } from "./nutrients";
import { mealNutrition } from "./nutrition";
import type { Product } from "./types";

const fm = new Map(foods.map((f) => [f.id, f]));
const mm = new Map(meals.map((m) => [m.id, m]));
const meal = meals.find((m) => !m.bought && m.items.length > 1)!;

describe("nutrients", () => {
  it("agrees with the existing totals for the numbers both know", () => {
    const t = mealTotals(meal, fm);
    const n = mealNutrition(meal, fm);
    expect(t.values.sat).toBeCloseTo(n.sat, 6);
    expect(t.values.na).toBeCloseTo(n.na, 6);
    expect(t.values.kcal).toBeCloseTo(n.kcal, 6);
    expect(t.values.sol).toBeCloseTo(n.sol, 6);
  });
  it("has protein, carbohydrate, fat and cholesterol for a USDA-based meal", () => {
    const t = mealTotals(meal, fm);
    for (const k of ["protein", "carbs", "fat", "chol"] as const) expect(t.known[k], k).toBe(true);
    expect(t.values.protein).toBeGreaterThan(0);
  });
  it("marks a total as a floor when an ingredient has no number, and 'not known' when none has", () => {
    const t = mealTotals(meal, fm);
    // plant sterols are only recorded for a few foods
    expect(showValue(t, "sterols")).toMatch(/not known|\+$/);
    const none = mealTotals({ ...meal, items: [{ foodId: "peri-peri-rub", measure: Object.keys(fm.get("peri-peri-rub")!.measures)[0] }] }, fm);
    expect(showValue(none, "protein")).toBe("not known");
  });
  it("lays a scanned pack's numbers over the food's", () => {
    const f = fm.get("hummus")!;
    const p: Product = { id: "hummus", foodId: "hummus", name: "Brand", per100: { kcal: 250, sat: 3, na: 700, protein: 9 }, packG: 200, lastPrice: 0, estimated: [] };
    const e = effectivePer100(f, p);
    expect(e.sat).toBe(3);
    expect(e.protein).toBe(9);
    expect(e.fibre).toBe(f.per100.fibre); // not on the label: the food's own
    expect(withProducts(fm, new Map([["hummus", p]])).get("hummus")!.per100.sat).toBe(3);
    expect(fm.get("hummus")!.per100.sat).not.toBe(3);
  });
  it("adds up a day, counting extras and supper for saturated fat and sodium only", () => {
    const day = { ...blankDay("2026-10-23"), eaten: [{ slot: "lunch" as const, mealId: meal.id, at: "13:00" }], extras: [{ kind: "Cake or sweet things", size: "normal", at: "" }] };
    const base = dayTotals({ ...day, extras: [] }, mm, fm);
    const withExtra = dayTotals(day, mm, fm, new Map(), { supper: { sat: 8, na: 900 } });
    expect(withExtra.values.sat).toBeGreaterThan(base.values.sat + 8);
    expect(withExtra.values.na).toBeGreaterThan(base.values.na + 900);
    expect(withExtra.partial.protein).toBe(true);
    expect(withExtra.values.protein).toBeCloseTo(base.values.protein, 6);
    expect(base.partial.sat).toBe(false);
  });
});
