import { describe, expect, it } from "vitest";
import { doneSlots, extraNutrition, offPlanSat, replacedNutrition } from "./offplan";

describe("off-plan food", () => {
  it("scales a known option by size", () => {
    expect(replacedNutrition({ what: "Pie from a bakery", size: "normal" })).toEqual({ sat: 12, na: 1000 });
    expect(replacedNutrition({ what: "Pie from a bakery", size: "small" }).sat).toBe(7.2);
    expect(replacedNutrition({ what: "Pie from a bakery", size: "big" }).sat).toBe(18);
  });
  it("treats skipping as nothing and unknown text as an average meal", () => {
    expect(replacedNutrition({ what: "Pie from a bakery", size: "skipped" })).toEqual({ sat: 0, na: 0 });
    expect(replacedNutrition({ what: "Mom's lasagne", size: "normal" }).sat).toBeGreaterThan(0);
  });
  it("handles extras", () => {
    expect(extraNutrition({ kind: "Chocolate", size: "big" }).sat).toBe(12); // the same factors as a swapped meal
    expect(extraNutrition({ kind: "Alcohol", size: "normal" }).sat).toBe(0);
  });
  it("counts replaced and eaten slots as done", () => {
    const d = { eaten: [{ slot: "breakfast" as const, mealId: "a", at: "08:00" }], replaced: [{ slot: "lunch" as const, what: "Pizza", size: "normal", at: "13:00" }] };
    expect(doneSlots(d).sort()).toEqual(["breakfast", "lunch"]);
  });
  it("only counts what a replacement goes over the plan by", () => {
    const d = { replaced: [{ slot: "lunch" as const, what: "Pizza", size: "normal", at: "13:00" }], extras: [{ kind: "Biscuits", size: "normal", at: "15:00" }] };
    expect(offPlanSat(d, () => 3)).toBe(6 + 3);          // pizza 9 - planned 3, plus biscuits 3
    expect(offPlanSat({ replaced: [{ slot: "lunch", what: "Salad bar", size: "small", at: "x" }], extras: [] }, () => 5)).toBe(0);
    expect(offPlanSat({ replaced: [{ slot: "lunch", what: "Pizza", size: "skipped", at: "x" }], extras: [] }, () => 5)).toBe(0);
  });
});

describe("food picked from the food list", () => {
  it("counts its real numbers, soluble fibre included", async () => {
    const { foods } = await import("./content");
    const fm = new Map(foods.map((f) => [f.id, f]));
    const psy = fm.get("psyllium")!;
    const n = extraNutrition({ kind: "2 × 1 tsp psyllium husk", size: "normal", food: { foodId: "psyllium", measure: "1 tsp", qty: 2 } }, fm);
    expect(n.sol).toBeCloseTo((psy.per100.sol * psy.measures["1 tsp"] * 2) / 100, 1);
    expect(n.sol!).toBeGreaterThan(5);
    // without the foods map, or for a food that's gone, it falls back to the rough guess
    expect(extraNutrition({ kind: "2 × x", size: "normal", food: { foodId: "psyllium", measure: "1 tsp", qty: 2 } }).sol).toBeUndefined();
    expect(extraNutrition({ kind: "Biscuits", size: "normal" }, fm)).toEqual({ sat: 3, na: 150 });
  });
  it("adds its fibre to the day's score and its saturated fat to the budget", async () => {
    const { foods, meals } = await import("./content");
    const { scoreDay } = await import("./score");
    const { blankDay } = await import("./backfill");
    const fm = new Map(foods.map((f) => [f.id, f])); const mm = new Map(meals.map((m) => [m.id, m]));
    const day = { ...blankDay("2026-10-25"), eaten: [{ slot: "breakfast" as const, mealId: "egg-toast", at: "08:00" }, { slot: "lunch" as const, mealId: "kauai-falafel", at: "13:00" }] };
    const base = scoreDay({ day, meals: mm, foods: fm, satCap: 17.5, supper: null, med: null });
    const plus = scoreDay({ day: { ...day, extras: [{ kind: "2 × 1 tsp psyllium husk", size: "normal", at: "", food: { foodId: "psyllium", measure: "1 tsp", qty: 2 } }] }, meals: mm, foods: fm, satCap: 17.5, supper: null, med: null });
    expect(plus.fibre).toBeGreaterThan(base.fibre + 5);
    expect(plus.points!).toBeGreaterThan(base.points!);
    // and a rough extra (cake) adds no fibre
    const cake = scoreDay({ day: { ...day, extras: [{ kind: "Cake or sweet things", size: "normal", at: "" }] }, meals: mm, foods: fm, satCap: 17.5, supper: null, med: null });
    expect(cake.fibre).toBe(base.fibre);
  });
});
