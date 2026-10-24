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
