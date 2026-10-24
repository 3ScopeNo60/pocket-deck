import { describe, expect, it } from "vitest";
import { foods } from "./content";
import { parseLabel, parseServing } from "./label";
import { applyServing } from "./serving";
import { mealNutrition } from "./nutrition";
import type { Food, Meal } from "./types";

describe("serving size from a label", () => {
  it("reads a household measure with its weight", () => {
    expect(parseServing("Serving size: 1 tsp (5 g)")).toEqual({ label: "1 tsp", g: 5 });
    expect(parseServing("Serving size 1 level teaspoon (3g)")).toEqual({ label: "1 tsp", g: 3 });
    expect(parseServing("Serving size: 1 tbsp (10g)")).toEqual({ label: "1 tbsp", g: 10 });
    expect(parseServing("Per serving: 2 tbsp (30 g)")).toEqual({ label: "1 tbsp", g: 15 });
    expect(parseServing("Serving size ½ cup (40 g)")).toEqual({ label: "1 cup", g: 80 });
    expect(parseServing("2 scoops (60g)")).toEqual({ label: "1 scoop", g: 30 });
  });
  it("falls back to a bare weight", () => {
    expect(parseServing("Serving size 30 g")).toEqual({ label: "1 serving", g: 30 });
    expect(parseServing("per 55 g single serving")).toEqual({ label: "1 serving", g: 55 });
    expect(parseServing("Per serving (25 g) Per 100 g")).toEqual({ label: "1 serving", g: 25 });
  });
  it("doesn't take per 100 g for a serving, or nothing for something", () => {
    expect(parseServing("Per 100 g\\nEnergy 100 kcal")).toBeUndefined();
    expect(parseServing("Serving size 100 g")).toBeUndefined();
    expect(parseLabel("Energy 100 kcal").serving).toBeUndefined();
    expect(parseLabel("Serving size: 1 tsp (5 g)\\nEnergy 100 kcal").serving).toEqual({ label: "1 tsp", g: 5 });
  });
});

describe("applying a serving", () => {
  const psy = (): Food => ({ ...foods.find((f) => f.id === "psyllium")!, measures: { ...foods.find((f) => f.id === "psyllium")!.measures } });
  it("changes what the measure weighs, so meals count it", () => {
    const f = psy();
    const m: Meal = { id: "x", slot: "snack", name: "x", emoji: "x", items: [{ foodId: "psyllium", measure: "1 tsp" }], steps: [], boosters: [], tags: [], cuisine: "x", keepsDays: 1 };
    const before = mealNutrition(m, new Map([["psyllium", f]])).sol;
    applyServing(f, { label: "1 tsp", g: 2.5 });
    expect(f.measures["1 tsp"]).toBe(2.5);
    expect(mealNutrition(m, new Map([["psyllium", f]])).sol).toBeCloseTo(before / 2, 6);
  });
  it("adds a measure that isn't there, and ignores nonsense", () => {
    const f = psy();
    applyServing(f, { label: "1 tbsp", g: 10 });
    expect(f.measures["1 tbsp"]).toBe(10);
    const keys = Object.keys(f.measures).length;
    applyServing(f, { label: "", g: 5 });
    applyServing(f, { label: "1 cup", g: 0 });
    applyServing(f, undefined);
    expect(Object.keys(f.measures).length).toBe(keys);
  });
});
