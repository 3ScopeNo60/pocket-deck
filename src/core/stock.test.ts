import { describe, expect, it } from "vitest";
import { addNeeds, addToStock, formatAmount, isLow, listTotal, restockGrams, stepGrams, takeStock, unlockList, unitFor, withStock } from "./stock";
import { FOODS, MEALS, PREFS, stock } from "./fixtures";
import { foods as realFoods } from "./content";
import type { Food, Product, StockItem } from "./types";

const real = new Map(realFoods.map((f) => [f.id, f]));
const food = (id: string) => real.get(id)!;

describe("amounts in kitchen measures", () => {
  it("counts cups, tins, slices and plain items", () => {
    expect(formatAmount(food("rolled-oats"), 500)).toBe("6 cups"); // 500 / 81
    expect(formatAmount(food("rolled-oats"), 81)).toBe("1 cup");
    expect(formatAmount(food("rolled-oats"), 40)).toBe("½ cup");
    expect(formatAmount(food("egg"), 600)).toBe("12");
    expect(formatAmount(food("wholewheat-bread"), 320)).toBe("10 slices");
    expect(formatAmount(food("tuna-water"), 240)).toBe("2 tins");
  });

  it("derives a unit from a fraction when there's no whole one", () => {
    expect(formatAmount(food("pilchards-tomato"), 400)).toBe("1 tin"); // measure is "½ tin" = 200 g
    expect(formatAmount(food("pilchards-tomato"), 120)).toBe("½ tin");
    expect(formatAmount(food("yoghurt-lowfat"), 123)).toBe("½ cup");
  });

  it("doesn't treat a prepared fraction as a unit", () => {
    // carrot has "½ cup grated" and a plain "1": count carrots, not cups of grated carrot
    expect(formatAmount(food("carrot"), 305)).toBe("5");
  });

  it("falls back to grams when a food has no everyday unit", () => {
    expect(unitFor(food("almonds"))).toBeNull();
    expect(formatAmount(food("almonds"), 154)).toBe("150 g");
    expect(stepGrams(food("almonds"))).toBe(50);
  });

  it("says None for nothing, and steps by one unit", () => {
    expect(formatAmount(food("egg"), 0)).toBe("None");
    expect(stepGrams(food("rolled-oats"))).toBe(81);
  });

  it("flags low stock at a quarter of the smallest pack", () => {
    expect(isLow(food("rolled-oats"), 100)).toBe(true); // pack 500 → low ≤ 125
    expect(isLow(food("rolled-oats"), 400)).toBe(false);
    expect(isLow(food("rolled-oats"), 0)).toBe(false); // out isn't "low"
  });
});

describe("restocking", () => {
  it("adds packs × pack size, scaled for dry foods stocked cooked", () => {
    expect(restockGrams(food("rolled-oats"), 2, 500)).toBe(1000);
    expect(restockGrams(food("brown-rice"), 1, 1000)).toBe(2700);
    expect(restockGrams(food("barley-cooked"), 1, 500)).toBe(1500);
  });

  it("adds to an existing row without duplicating it", () => {
    const { next, row } = addToStock(stock({ oats: 200, milk: 100 }), "oats", 300, "t");
    expect(next).toHaveLength(2);
    expect(row.grams).toBe(500);
  });
});

describe("shopping list", () => {
  const f = FOODS as Map<string, Food>;

  it("rounds a need up to shop packs", () => {
    const rows = addNeeds([], [{ foodId: "oats", needG: 620 }], f, "unlock");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ itemId: "oats", packs: 2, shopUnitG: 500, reason: "unlock", needG: 620, checked: false });
  });

  it("is safe to add twice, and keeps the larger need", () => {
    const once = addNeeds([], [{ foodId: "tuna", needG: 120 }], f, "unlock");
    const twice = addNeeds(once, [{ foodId: "tuna", needG: 120 }], f, "plan");
    expect(twice).toHaveLength(1);
    expect(twice[0].packs).toBe(once[0].packs);
    expect(twice[0].reason).toBe("unlock"); // earliest reason is kept
    const bigger = addNeeds(twice, [{ foodId: "tuna", needG: 300 }], f, "plan");
    expect(bigger[0]).toMatchObject({ packs: 3, shopUnitG: 120 });
  });

  it("keeps a ticked row ticked when it's re-added", () => {
    const rows = addNeeds([], [{ foodId: "oats", needG: 100 }], f, "low").map((r) => ({ ...r, checked: true }));
    expect(addNeeds(rows, [{ foodId: "oats", needG: 100 }], f, "low")[0].checked).toBe(true);
  });

  it("ignores unknown foods and zero needs", () => {
    expect(addNeeds([], [{ foodId: "nope", needG: 100 }, { foodId: "oats", needG: 0 }], f, "manual")).toEqual([]);
  });

  it("totals at last prices and counts what's unpriced", () => {
    const rows = addNeeds([], [{ foodId: "oats", needG: 500 }, { foodId: "tuna", needG: 120 }], f, "plan");
    const products = new Map<string, Product>([["oats", { id: "p", foodId: "oats", name: "Oats", per100: { sat: 1, na: 5, kcal: 380 }, packG: 500, lastPrice: 24.99, estimated: [] }]]);
    expect(listTotal(rows, products)).toEqual({ total: 25, unpriced: 1 });
  });
});

describe("meals to unlock", () => {
  const f = FOODS as Map<string, Food>;

  it("lists meals that aren't ready, fewest missing first, with exact shortfalls", () => {
    const list = unlockList(MEALS, f, stock({ oats: 500, milk: 1000, apple: 400, beans: 480, tuna: 0 }), PREFS());
    const ids = list.map((e) => e.meal.id);
    expect(ids).toContain("tuna-bowl");
    expect(ids).not.toContain("oats-bowl"); // ready
    expect(ids).not.toContain("takeaway"); // bought meals are always ready
    const tuna = list.find((e) => e.meal.id === "tuna-bowl")!;
    expect(tuna.missing).toEqual([{ foodId: "tuna", needG: 120, haveG: 0 }]);
  });

  it("leaves out hidden meals and meals with a food marked No", () => {
    const prefs = PREFS({ meals: { "tuna-bowl": { state: "hidden" } }, foods: { feta: "no" } });
    const ids = unlockList(MEALS, f, stock({}), prefs).map((e) => e.meal.id);
    expect(ids).not.toContain("tuna-bowl");
    expect(ids).not.toContain("feta-bowl");
  });
});

describe("the audit's stock fixes", () => {
  const row = (itemId: string, grams: number): StockItem => ({ itemId, kind: "food", grams, updatedAt: "" });
  const gramsOf = (st: StockItem[], id: string) => st.find((r) => r.itemId === id)?.grams;

  it("puts back exactly what came out, even when the pantry was short", () => {
    const st = [row("oats", 50)];
    const out = takeStock(st, { oats: 80, ghost: 30 }, "t");
    expect(gramsOf(out.next, "oats")).toBe(0);
    expect(out.removed).toEqual({ oats: 50 }); // no row for 'ghost': nothing taken
    const back = withStock(out.next, out.removed, 1, "t");
    expect(gramsOf(back.next, "oats")).toBe(50);
    expect(gramsOf(back.next, "ghost")).toBeUndefined(); // undo doesn't invent stock
  });
  it("takes the full amount when there is enough", () => {
    const out = takeStock([row("oats", 500)], { oats: 80 }, "t");
    expect(out.removed).toEqual({ oats: 80 });
    expect(gramsOf(out.next, "oats")).toBe(420);
  });

  it("buys dry packs for cooked quantities", () => {
    // 1200 g of cooked lentils is 480 g dry: one 500 g pack, not three
    const lentils = food("lentils");
    const rows = addNeeds([], [{ foodId: "lentils", needG: 1200 }], real, "plan");
    expect(lentils.cookedYield).toBeGreaterThan(1);
    expect(rows[0].packs).toBe(1);
    expect(rows[0].shopUnitG).toBe(500);
    // foods without a yield are unchanged
    const oats = addNeeds([], [{ foodId: "rolled-oats", needG: 1200 }], real, "plan");
    expect(oats[0].packs * oats[0].shopUnitG).toBeGreaterThanOrEqual(1200);
  });
});

