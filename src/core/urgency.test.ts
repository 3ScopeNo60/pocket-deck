import { describe, expect, it } from "vitest";
import { foods as shipped, meals as allMeals } from "./content";
import { groupOf, projectStock, runningOut, urgencyOf } from "./urgency";
import type { StockItem } from "./types";

const fm = new Map(shipped.map((f) => [f.id, f]));
const mm = new Map(allMeals.map((m) => [m.id, m]));
const row = (itemId: string, grams: number): StockItem => ({ itemId, kind: "food", grams, updatedAt: "" });
const meal = allMeals.find((m) => !m.bought && m.items.some((i) => i.foodId === "rolled-oats"))!;

describe("running out", () => {
  it("finds the first day a planned meal runs short", () => {
    const p = projectStock([row("rolled-oats", 100)], [{ date: "2026-10-28", mealIds: [meal.id] }, { date: "2026-10-27", mealIds: [meal.id, meal.id, meal.id] }], mm, fm);
    expect(p.short.get("rolled-oats")?.date).toBe("2026-10-27"); // earlier day first, whatever the order given
    expect(p.short.get("rolled-oats")!.needG).toBeGreaterThan(0);
  });
  it("lists what is short, what is low now, and what will be nearly gone by the end", () => {
    const unused = (id: string) => expect(meal.items.some((i) => i.foodId === id)).toBe(false);
    unused("tahini"); unused("chia");
    const stock = [row("rolled-oats", 100), row("tahini", 20), row("chia", 600)];
    const p = projectStock(stock, [{ date: "2026-10-27", mealIds: [meal.id, meal.id, meal.id] }], mm, fm);
    const r = runningOut(stock, p, fm);
    const kinds = Object.fromEntries(r.map((x) => [x.foodId, x.kind]));
    expect(kinds["rolled-oats"]).toBe("short");
    expect(kinds["tahini"]).toBe("low"); // under a quarter of its smallest pack, used by nothing planned
    expect(kinds["chia"]).toBeUndefined();
  });
  it("puts what is short before what is only low", () => {
    const stock = [row("tahini", 20), row("rolled-oats", 100)];
    const p = projectStock(stock, [{ date: "2026-10-27", mealIds: [meal.id, meal.id, meal.id] }], mm, fm);
    const r = runningOut(stock, p, fm);
    const at = r.findIndex((x) => x.foodId === "tahini");
    expect(at).toBeGreaterThan(0);
    expect(r.slice(0, at).every((x) => x.kind === "short")).toBe(true);
    expect(r.slice(at).every((x) => x.kind !== "short")).toBe(true);
  });
});

describe("urgency of a list row", () => {
  const p = projectStock([row("rolled-oats", 0)], [{ date: "2026-10-27", mealIds: [meal.id] }], mm, fm);
  it("is set by the day a planned meal needs it", () => {
    expect(urgencyOf({ itemId: "rolled-oats", reason: "plan" }, p, "2026-10-26")).toMatchObject({ rank: 1, label: "Needed tomorrow", urgent: true });
    expect(urgencyOf({ itemId: "rolled-oats", reason: "plan" }, p, "2026-10-27")).toMatchObject({ rank: 0, label: "Needed today", urgent: true });
    expect(urgencyOf({ itemId: "rolled-oats", reason: "plan" }, p, "2026-10-24")).toMatchObject({ label: "Needed by Tue", urgent: false });
  });
  it("falls back to the reason when no planned meal is short", () => {
    expect(urgencyOf({ itemId: "chia", reason: "low" }, p, "2026-10-26").label).toBe("Running low");
    expect(urgencyOf({ itemId: "chia", reason: "unlock" }, p, "2026-10-26").rank).toBeGreaterThan(urgencyOf({ itemId: "chia", reason: "manual" }, p, "2026-10-26").rank);
  });
  it("groups rows for the week, by him, and for unlocking", () => {
    expect(["plan", "low", "manual", "unlock"].map((r) => groupOf({ reason: r as never }))).toEqual(["week", "week", "mine", "unlock"]);
  });
});
