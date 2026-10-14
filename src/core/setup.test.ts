import { describe, expect, it } from "vitest";
import { anchorGaps, applySetup, foodsToSwipe, mealsToSwipe, startingFoodAnswers, type FoodAnswer } from "./setup";
import { foods, meals, startingMealIds } from "./content";
import type { Prefs } from "./types";

const base: Prefs = { flavours: [], foods: {}, meals: Object.fromEntries(startingMealIds.map((id) => [id, { state: "kept" as const }])), firstTriedAt: {} };

describe("foodsToSwipe", () => {
  const list = foodsToSwipe(foods, meals);
  it("asks about at most 40 foods, none of them seasonings, all used by some meal", () => {
    expect(list.length).toBeLessThanOrEqual(40);
    expect(list.length).toBeGreaterThanOrEqual(30);
    const used = new Set(meals.flatMap((m) => m.items.map((i) => i.foodId)));
    for (const f of list) expect(used.has(f.id), f.id).toBe(true);
    expect(list.find((f) => f.id === "cumin")).toBeUndefined();
  });
  it("leaves out foods the user already eats, then fills up to the cap from what's left", () => {
    const eats = new Set(Object.keys(startingFoodAnswers(meals, startingMealIds)));
    const rest = foodsToSwipe(foods, meals, 40, eats);
    expect(rest.some((f) => eats.has(f.id))).toBe(false);
    expect(rest.length).toBeGreaterThan(foodsToSwipe(foods, meals).filter((f) => !eats.has(f.id)).length - 1);
  });
  it("puts anchor foods first so the important ones are always asked", () => {
    const firstNonAnchor = list.findIndex((f) => f.anchors.length === 0);
    expect(list.slice(0, firstNonAnchor).every((f) => f.anchors.length > 0)).toBe(true);
    for (const id of ["rolled-oats", "chickpeas", "almonds"]) expect(list.map((f) => f.id)).toContain(id);
  });
});

describe("meals", () => {
  const liked = startingFoodAnswers(meals, startingMealIds);
  it("foods in his own meals start liked", () => {
    expect(liked["rolled-oats"]).toBe("like");
    expect(liked["tuna-water"]).toBe("like");
  });
  it("offers only meals that aren't his own and use nothing he said No to", () => {
    const answers: Record<string, FoodAnswer> = { ...liked, feta: "no", lentils: "no" };
    const offered = mealsToSwipe(meals, answers, [], startingMealIds);
    expect(offered.some((m) => startingMealIds.includes(m.id))).toBe(false);
    expect(offered.some((m) => m.items.some((i) => i.foodId === "feta" || i.foodId === "lentils"))).toBe(false);
    expect(offered.length).toBeGreaterThan(10);
  });
  it("puts meals that match his flavours first", () => {
    const offered = mealsToSwipe(meals, liked, ["warm", "spicy"], startingMealIds);
    expect(["Cape Malay", "Indian"]).toContain(offered[0].cuisine);
  });
});

describe("anchorGaps", () => {
  it("finds an anchor with nothing left, and suggests easier routes", () => {
    const noLegumes = Object.fromEntries(foods.filter((f) => f.anchors.includes("legume")).map((f) => [f.id, "no" as FoodAnswer]));
    const gaps = anchorGaps(foods, noLegumes);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].anchor).toBe("legume");
    expect(gaps[0].routes.length).toBeGreaterThan(0);
  });
  it("is quiet while at least one food in the anchor is still allowed", () => {
    const answers: Record<string, FoodAnswer> = { hummus: "no", chickpeas: "no" };
    expect(anchorGaps(foods, answers)).toEqual([]);
  });
});

describe("applySetup", () => {
  it("records flavours and food answers, keeps liked meals and hides skipped ones", () => {
    const next = applySetup(base, { flavours: ["spicy"], foods: { feta: "no" }, keptMeals: ["lentil-soup"], skippedMeals: ["chana-masala"] });
    expect(next.setupDone).toBe(true);
    expect(next.flavours).toEqual(["spicy"]);
    expect(next.foods.feta).toBe("no");
    expect(next.meals["lentil-soup"].state).toBe("kept");
    expect(next.meals["chana-masala"].state).toBe("hidden");
    expect(next.meals["oats-overnight"].state).toBe("kept"); // his own meals are untouched
    expect(base.setupDone).toBeUndefined(); // doesn't change its input
  });
});
