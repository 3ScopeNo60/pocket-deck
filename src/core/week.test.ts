import { describe, expect, it } from "vitest";
import { planWeek, prepLines, swapInWeek, tagTonight } from "./week";
import { foods, meals, startingMealIds } from "./content";
import { SLOTS, dayBudget } from "./planner";
import { mealGrams } from "./nutrition";
import type { Prefs, StockItem } from "./types";

const foodMap = new Map(foods.map((f) => [f.id, f]));
const prefs: Prefs = { flavours: [], foods: {}, meals: Object.fromEntries(startingMealIds.map((id) => [id, { state: "kept" as const }])), firstTriedAt: {} };
const dates = Array.from({ length: 7 }, (_, i) => `2026-10-${String(15 + i).padStart(2, "0")}`);
const base = { dates, tonight: {}, meals, foods: foodMap, prefs, satCap: 17.5, stock: [] as StockItem[] };

describe("planWeek", () => {
  const r = planWeek(base);

  it("fills every slot of every day, even with an empty pantry", () => {
    for (const d of dates) for (const s of SLOTS) expect(r.days[d].plan[s], `${d} ${s}`).toBeTruthy();
  });

  it("has variety: no meal more than three times in the week", () => {
    const counts = new Map<string, number>();
    for (const d of dates) for (const s of SLOTS) counts.set(r.days[d].plan[s]!, (counts.get(r.days[d].plan[s]!) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    expect(counts.size).toBeGreaterThanOrEqual(8);
  });

  it("never plans the same breakfast two days in a row", () => {
    for (let i = 1; i < dates.length; i++) expect(r.days[dates[i]].plan.breakfast).not.toBe(r.days[dates[i - 1]].plan.breakfast);
  });

  it("needs exactly what the plan uses when the pantry is empty", () => {
    const byId = new Map(meals.map((m) => [m.id, m]));
    const total: Record<string, number> = {};
    for (const d of dates) for (const s of SLOTS) {
      const m = byId.get(r.days[d].plan[s]!)!;
      if (m.bought) continue;
      for (const [f, g] of Object.entries(mealGrams(m, foodMap))) total[f] = (total[f] ?? 0) + g;
    }
    const need = Object.fromEntries(r.needs.map((n) => [n.foodId, n.needG]));
    for (const [f, g] of Object.entries(total)) expect(need[f]).toBe(Math.round(g));
  });

  it("takes what's in the pantry off the shopping, and today's held meals first", () => {
    const stock: StockItem[] = [{ itemId: "rolled-oats", kind: "food", grams: 100000, updatedAt: "" }];
    expect(planWeek({ ...base, stock }).needs.find((n) => n.foodId === "rolled-oats")).toBeUndefined();
    // Three pinned oat breakfasts need 120 g; with 100 g in the pantry that's 20 g short...
    const oats = { breakfast: "oats-overnight", lunch: "kauai-falafel", snack: "apple-almonds" };
    const existing = Object.fromEntries(dates.slice(0, 3).map((d) => [d, { tonight: "normal" as const, plan: oats, pinned: true }]));
    const hundred: StockItem[] = [{ itemId: "rolled-oats", kind: "food", grams: 100, updatedAt: "" }];
    const need = (x: ReturnType<typeof planWeek>) => x.needs.find((n) => n.foodId === "rolled-oats")?.needG ?? 0;
    const without = planWeek({ ...base, stock: hundred, existing });
    // ...and 40 g more is spoken for by today's own oats, so 60 g short.
    const held = planWeek({ ...base, stock: hundred, existing, heldIds: ["oats-overnight"] });
    expect(need(without)).toBeGreaterThanOrEqual(20);
    expect(need(held) - need(without)).toBe(40);
  });

  it("keeps a heavy-supper day within its smaller budget", () => {
    const tag = planWeek({ ...base, tonight: { [dates[2]]: "heavy", [dates[3]]: "light" } });
    const sat = (date: string) => SLOTS.reduce((t, s) => t + meals.find((m) => m.id === tag.days[date].plan[s])!.items.reduce((a, i) => a + (foodMap.get(i.foodId)!.per100.sat * foodMap.get(i.foodId)!.measures[i.measure]) / 100, 0), 0);
    const heavy = dayBudget({ satCap: base.satCap, lastNightSat: null, tonight: "heavy" }).budget;
    const light = dayBudget({ satCap: base.satCap, lastNightSat: null, tonight: "light" }).budget;
    expect(heavy).toBeLessThan(light);
    // Each day fits its own budget. Which meals a day gets also depends on variety across the week, so a heavy day isn't always the lighter one.
    expect(sat(dates[2])).toBeLessThanOrEqual(heavy + 0.001);
    expect(sat(dates[3])).toBeLessThanOrEqual(light + 0.001);
    expect(tag.days[dates[2]].tonight).toBe("heavy");
  });

  it("keeps a pinned day when the week is re-planned", () => {
    const first = planWeek(base);
    const pinned = { ...first.days, [dates[1]]: { ...first.days[dates[1]], pinned: true, plan: { breakfast: "pb-banana-rye", lunch: "kauai-falafel", snack: "apple-almonds" } } };
    const again = planWeek({ ...base, existing: pinned });
    expect(again.days[dates[1]].plan).toEqual(pinned[dates[1]].plan);
    expect(again.days[dates[1]].pinned).toBe(true);
  });
});

describe("swapInWeek and tags", () => {
  const first = planWeek(base);
  it("swaps one slot, pins the day, and changes only that slot", () => {
    const swapped = swapInWeek(first.days, dates[0], "lunch", 1, base)!;
    expect(swapped[dates[0]].plan.lunch).not.toBe(first.days[dates[0]].plan.lunch);
    expect(swapped[dates[0]].plan.breakfast).toBe(first.days[dates[0]].plan.breakfast);
    expect(swapped[dates[0]].pinned).toBe(true);
    expect(swapped[dates[1]]).toEqual(first.days[dates[1]]);
  });
  it("tags a night without touching the meals", () => {
    const t = tagTonight(first.days, dates[4], "heavy");
    expect(t[dates[4]].tonight).toBe("heavy");
    expect(t[dates[4]].plan).toEqual(first.days[dates[4]].plan);
  });
});

describe("prepLines", () => {
  it("lists make-ahead meals with the days they're eaten, and flags ones that outlast their shelf life", () => {
    const week = Object.fromEntries(dates.map((d) => [d, { tonight: "normal" as const, plan: { breakfast: null, lunch: "chicken-salad", snack: null } }]));
    const lines = prepLines(week, meals);
    expect(lines).toHaveLength(1);
    expect(lines[0].dates).toHaveLength(7);
    expect(lines[0].splits).toBe(true); // keeps 3 days, eaten across 7
  });
  it("ignores meals with nothing to prep", () => {
    const week = { [dates[0]]: { tonight: "normal" as const, plan: { breakfast: "egg-toast", lunch: null, snack: "apple-almonds" } } };
    expect(prepLines(week, meals)).toEqual([]);
  });
});
