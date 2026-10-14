import { describe, expect, it } from "vitest";
import { prepFor, tomorrowPlan } from "./tomorrow";
import { foods, meals } from "./content";
import { defaultPrefs } from "../app/defaults";

const foodMap = new Map(foods.map((f) => [f.id, f]));
const mealMap = new Map(meals.map((m) => [m.id, m]));
const none = { breakfast: null, lunch: null, snack: null };

describe("tomorrow", () => {
  it("finds the meals that are made the night before", () => {
    const prep = prepFor({ ...none, breakfast: "oats-overnight", lunch: "oats-overnight" }, mealMap, foodMap);
    expect(prep).toHaveLength(1);
    expect(prep[0].mealId).toBe("oats-overnight");
    expect(prep[0].text).toMatch(/^Make the /);
    expect(prep[0].detail).toMatch(/Fridge till morning/);
    expect(prepFor(none, mealMap, foodMap)).toEqual([]);
  });

  it("uses the week plan for that date, with what it's short of", () => {
    const week = { "2026-10-15": { tonight: "normal" as const, plan: { ...none, breakfast: "oats-overnight" } } };
    const r = tomorrowPlan({ date: "2026-10-15", week, meals, foods: foodMap, prefs: defaultPrefs(), satCap: 17.5, stock: [] });
    expect(r.source).toBe("week");
    expect(r.plan.breakfast).toBe("oats-overnight");
    expect(r.needs.length).toBeGreaterThan(0);
    expect(r.prep.map((p) => p.mealId)).toEqual(["oats-overnight"]);
  });

  it("deals the day when there's no plan, and needs nothing from a full pantry", () => {
    const full = foods.map((f) => ({ itemId: f.id, kind: "food" as const, grams: 50_000, updatedAt: "" }));
    const r = tomorrowPlan({ date: "2026-10-15", week: null, meals, foods: foodMap, prefs: defaultPrefs(), satCap: 17.5, stock: full });
    expect(r.source).toBe("dealt");
    expect(Object.values(r.plan).filter(Boolean).length).toBeGreaterThan(0);
    expect(r.needs).toEqual([]);
  });
});
