import { describe, expect, it } from "vitest";
import { estCost, foods, meals, startingMealIds, suppers } from "./content";
import { mealGrams, mealNutrition, targets } from "./nutrition";
import { dayBudget, deal, isReady, supperSat } from "./planner";
import type { Prefs, StockItem } from "./types";
import { starterStock } from "../app/defaults";
import { FLAVOUR_KIT, aisleOf, AISLES } from "../app/aisles";

const foodMap = new Map(foods.map((f) => [f.id, f]));
const prefs: Prefs = { flavours: [], foods: {}, meals: Object.fromEntries(startingMealIds.map((id) => [id, { state: "kept" as const }])), firstTriedAt: {} };

describe("shipped content", () => {
  it("every meal resolves: known foods, known measures", () => {
    for (const m of meals) {
      expect(() => mealNutrition(m, foodMap), m.id).not.toThrow();
      expect(() => mealGrams(m, foodMap), m.id).not.toThrow();
      if (!m.bought) expect(m.items.length, m.id).toBeGreaterThan(0);
    }
  });

  it("has unique ids and the three slots covered", () => {
    expect(new Set(meals.map((m) => m.id)).size).toBe(meals.length);
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
    for (const slot of ["breakfast", "lunch", "snack"] as const) expect(meals.filter((m) => m.slot === slot).length).toBeGreaterThanOrEqual(5);
  });

  it("keeps soluble fibre within total fibre, and food data plausible", () => {
    for (const f of foods) {
      expect(f.per100.sol, f.id).toBeLessThanOrEqual(f.per100.fibre + 0.01);
      expect(f.per100.sat, f.id).toBeLessThanOrEqual(f.per100.kcal / 9 + 0.5);
      expect(f.packSizes.length, f.id).toBeGreaterThan(0);
    }
  });

  it("covers the user's own meals and every supper option", () => {
    expect(startingMealIds.length).toBeGreaterThanOrEqual(8);
    expect(suppers.some((s) => s.id === "braai")).toBe(true);
    const braai = suppers.find((x) => x.id === "braai")!;
    expect(supperSat(braai.sat, "Big")).toBeCloseTo(18.9, 5);
    expect(estCost.get("oats-overnight")).toBeGreaterThan(0);
  });

  it("plans a full realistic day from a stocked kitchen, inside the budget", () => {
    const stock: StockItem[] = foods.map((f) => ({ itemId: f.id, kind: "food", grams: 2000, updatedAt: "2026-10-14T07:00:00Z" }));
    const satCap = targets({ heightCm: 180, weightKg: 85, age: 35, sex: "male", activity: "moderate", hand: "right", budgetPerWeek: 500, units: "kitchen" }).satCap;
    const { budget } = dayBudget({ satCap, lastNightSat: null, tonight: "normal" });
    const r = deal({ meals, foods: foodMap, budget, stock, prefs, today: "2026-10-14" });
    expect(Object.values(r.pick).every(Boolean)).toBe(true);
    const total = (["breakfast", "lunch", "snack"] as const).reduce((t, s) => t + mealNutrition(meals.find((m) => m.id === r.pick[s])!, foodMap).sat, 0);
    expect(total).toBeLessThanOrEqual(budget);
    for (const id of Object.values(r.pick)) expect(isReady(meals.find((m) => m.id === id)!, stock, {}, foodMap)).toBe(true);
  });

  it("with an empty kitchen, deals only bought meals and offers near-misses", () => {
    const r = deal({ meals, foods: foodMap, budget: 12, stock: [], prefs, today: "2026-10-14" });
    expect(r.pick.breakfast).toBeNull();
    expect(r.pick.lunch).toBe("kauai-falafel");
    expect(r.nearMiss.breakfast).toBeDefined();
  });

  it("the starter pantry and flavour kit only use foods that exist, and every food has an aisle", () => {
    for (const row of starterStock()) expect(foodMap.has(row.itemId), row.itemId).toBe(true);
    for (const id of FLAVOUR_KIT) expect(foodMap.has(id), id).toBe(true);
    for (const f of foods) expect(AISLES).toContain(aisleOf(f.id));
  });
});
