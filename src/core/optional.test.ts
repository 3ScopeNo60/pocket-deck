import { describe, expect, it } from "vitest";
import { foods, meals } from "./content";
import { blankDay } from "./backfill";
import { leftOutFor, mealGrams, mealNutrition } from "./nutrition";
import { isReady, shortfall } from "./planner";
import { scoreDay } from "./score";
import { mealTotals } from "./nutrients";
import type { StockItem } from "./types";

const fm = new Map(foods.map((f) => [f.id, f]));
const mm = new Map(meals.map((m) => [m.id, m]));
const oats = mm.get("oats-warm")!;
const row = (itemId: string, grams: number): StockItem => ({ itemId, kind: "food", grams, updatedAt: "" });
// everything oats-warm needs except the milk
const noMilk = oats.items.filter((i) => !i.optional).map((i) => row(i.foodId, 5000));

describe("an optional ingredient (milk on oats)", () => {
  it("is marked in the content", () => {
    expect(oats.items.find((i) => i.foodId === "milk-lowfat")?.optional).toBe(true);
    expect(oats.items.filter((i) => !i.optional).length).toBeGreaterThan(0);
  });
  it("doesn't stop the meal being made", () => {
    expect(isReady(oats, noMilk, {}, fm)).toBe(true);
    expect(shortfall(oats, noMilk, {}, fm)).toEqual([]);
    // ...while a required ingredient still does
    expect(isReady(oats, noMilk.filter((s) => s.itemId !== "rolled-oats"), {}, fm)).toBe(false);
  });
  it("is left out of what the pantry has to hold, and out of the numbers when he goes without", () => {
    expect(mealGrams(oats, fm, { required: true })["milk-lowfat"]).toBeUndefined();
    expect(mealGrams(oats, fm)["milk-lowfat"]).toBeGreaterThan(0);
    const withMilk = mealNutrition(oats, fm);
    const water = mealNutrition(oats, fm, undefined, ["milk-lowfat"]);
    expect(water.sat).toBeLessThan(withMilk.sat - 2);
    expect(water.kcal).toBeLessThan(withMilk.kcal);
    expect(mealTotals(oats, fm, undefined, ["milk-lowfat"]).values.sat).toBeCloseTo(water.sat, 6);
  });
  it("is left out when he chose to, or has none", () => {
    const have = (id: string) => (id === "milk-lowfat" ? 0 : 500);
    expect(leftOutFor(oats, have)).toEqual(["milk-lowfat"]); // none in the pantry: water
    expect(leftOutFor(oats, () => 500)).toEqual([]);
    expect(leftOutFor(oats, () => 500, ["milk-lowfat"])).toEqual(["milk-lowfat"]); // chose to
    expect(leftOutFor(oats, () => 500, ["rolled-oats"])).toEqual([]); // only optional ones can be left out
  });
  it("counts in the day's score only when it was used", () => {
    const base = { meals: mm, foods: fm, satCap: 17.5, supper: null, med: null };
    const day = (left?: string[]) => ({ ...blankDay("2026-10-26"), eaten: [{ slot: "breakfast" as const, mealId: "oats-warm", at: "07:30", ...(left ? { left } : {}) }, { slot: "lunch" as const, mealId: "chicken-salad", at: "13:00" }] });
    expect(scoreDay({ ...base, day: day(["milk-lowfat"]) }).sat).toBeLessThan(scoreDay({ ...base, day: day() }).sat - 2);
  });
});
