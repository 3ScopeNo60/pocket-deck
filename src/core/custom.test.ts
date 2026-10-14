import { describe, expect, it } from "vitest";
import { buildCustomMeal, draftProblem, type MealDraft } from "./custom";
import { foods } from "./content";
import { mealNutrition } from "./nutrition";

const fm = new Map(foods.map((f) => [f.id, f]));
const oats = foods.find((f) => f.id.includes("oat"))!;
const firstMeasure = (id: string) => Object.keys(fm.get(id)!.measures)[0];
const draft = (over: Partial<MealDraft> = {}): MealDraft => ({ name: "Gran's oats", emoji: "🥣", slot: "breakfast", items: [{ foodId: oats.id, measure: firstMeasure(oats.id) }], steps: "Cook\n\n  Eat  ", ...over });

describe("own meals", () => {
  it("needs a name and an ingredient", () => {
    expect(draftProblem(draft({ name: " " }), fm)).toMatch(/name/);
    expect(draftProblem(draft({ items: [] }), fm)).toMatch(/ingredient/);
    expect(draftProblem(draft({ items: [{ foodId: oats.id, measure: "a bucket" }] }), fm)).toMatch(/amount/);
    expect(draftProblem(draft(), fm)).toBeNull();
  });
  it("builds a meal the nutrition code can read, with unique ids", () => {
    const m = buildCustomMeal(draft(), new Set(), fm);
    expect(m.id).toBe("my-gran-s-oats");
    expect(m.steps).toEqual(["Cook", "Eat"]);
    expect(m.tags).toContain("Your own");
    expect(mealNutrition(m, fm).kcal).toBeGreaterThan(0);
    expect(buildCustomMeal(draft(), new Set([m.id]), fm).id).toBe("my-gran-s-oats-2");
  });
});
