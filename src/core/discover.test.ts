import { describe, expect, it } from "vitest";
import { decideMeal, discoverMeals, pendingMeals } from "./discover";
import { deal } from "./planner";
import { foods, meals } from "./content";
import type { Prefs, StockItem } from "./types";

const blank = (over: Partial<Prefs> = {}): Prefs => ({ flavours: [], foods: {}, meals: {}, firstTriedAt: {}, ...over });
const ids = ["a", "b", "c"];

describe("discoverMeals", () => {
  it("announces nothing the first time: everything shipped is already seen", () => {
    const r = discoverMeals(ids, blank());
    expect(r.added).toEqual([]);
    expect(r.prefs.seenMeals).toEqual(ids);
    expect(pendingMeals(ids, r.prefs)).toEqual([]);
  });

  it("flags meals that appear in an update and holds them back", () => {
    const r = discoverMeals([...ids, "d", "e"], blank({ seenMeals: ids }));
    expect(r.added).toEqual(["d", "e"]);
    expect(r.prefs.meals.d).toEqual({ state: "new" });
    expect(pendingMeals([...ids, "d", "e"], r.prefs)).toEqual(["d", "e"]);
    expect(r.prefs.seenMeals).toEqual([...ids, "d", "e"]);
  });

  it("is idempotent: opening again doesn't re-announce or change anything", () => {
    const first = discoverMeals([...ids, "d"], blank({ seenMeals: ids }));
    const second = discoverMeals([...ids, "d"], first.prefs);
    expect(second.added).toEqual([]);
    expect(second.prefs).toBe(first.prefs);
  });

  it("never overrides a decision already made, and ignores removed meals", () => {
    const prefs = blank({ seenMeals: ["a"], meals: { b: { state: "hidden" } } });
    const r = discoverMeals(["a", "b", "c"], prefs);
    expect(r.added).toEqual(["c"]);
    expect(r.prefs.meals.b.state).toBe("hidden");
    expect(pendingMeals(["a", "b"], r.prefs)).toEqual([]);
  });
});

describe("decideMeal", () => {
  const p = blank({ meals: { d: { state: "new" }, k: { state: "kept" } } });
  it("keeps or hides a pending meal", () => {
    expect(decideMeal(p, "d", true).meals.d.state).toBe("kept");
    expect(decideMeal(p, "d", false).meals.d.state).toBe("hidden");
  });
  it("leaves meals that aren't pending alone", () => {
    expect(decideMeal(p, "k", false)).toBe(p);
    expect(decideMeal(p, "zzz", true)).toBe(p);
  });
});

describe("a pending meal is never dealt", () => {
  it("is held out of the plan until it's kept", () => {
    const stock: StockItem[] = foods.map((f) => ({ itemId: f.id, kind: "food", grams: 5000, updatedAt: "" }));
    const everyMealNew = Object.fromEntries(meals.map((m) => [m.id, { state: "new" as const }]));
    const foodMap = new Map(foods.map((f) => [f.id, f]));
    const held = deal({ meals, foods: foodMap, budget: 20, stock, prefs: blank({ meals: everyMealNew }), today: "2026-10-14" });
    expect(Object.values(held.pick).every((x) => x === null)).toBe(true);
    const one = deal({ meals, foods: foodMap, budget: 20, stock, prefs: blank({ meals: { ...everyMealNew, "oats-overnight": { state: "kept" } } }), today: "2026-10-14" });
    expect(one.pick.breakfast).toBe("oats-overnight");
  });
});
