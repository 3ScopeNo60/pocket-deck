import { describe, expect, it } from "vitest";
import { PLATE, TONIGHT_BUFFER, dayBudget, deal, isReady, nextFitting, reserved, shortfall } from "./planner";
import { FOODS, MEALS, PREFS, stock } from "./fixtures";

const base = (o: Partial<Parameters<typeof deal>[0]> = {}) => ({
  meals: MEALS, foods: FOODS, budget: 20, stock: stock({ oats: 500, milk: 1000, tuna: 120, beans: 480, feta: 100, apple: 400 }),
  prefs: PREFS(), today: "2026-10-14", ...o,
});

describe("dayBudget", () => {
  it("holds back tonight's buffer", () => {
    expect(dayBudget({ satCap: 15, lastNightSat: null, tonight: "normal" })).toEqual({ budget: 8, carry: 0 });
    expect(dayBudget({ satCap: 15, lastNightSat: null, tonight: "heavy" }).budget).toBe(4);
    expect(TONIGHT_BUFFER.light).toBe(4);
  });

  it("carries half of last night's overshoot, capped at 4 g", () => {
    const braai = 14 * PLATE.Big; // 18.9 g
    expect(dayBudget({ satCap: 18.5, lastNightSat: braai, tonight: "normal" })).toMatchObject({ carry: 4 });
    expect(dayBudget({ satCap: 18.5, lastNightSat: 9, tonight: "normal" })).toMatchObject({ carry: 1 });
    expect(dayBudget({ satCap: 18.5, lastNightSat: 3, tonight: "normal" }).carry).toBe(0);
  });

  it("never drops below 2.5 g", () => {
    expect(dayBudget({ satCap: 10, lastNightSat: 30, tonight: "heavy" }).budget).toBe(2.5);
  });
});

describe("readiness", () => {
  it("reserves ingredients planned for other days", () => {
    const r = reserved(["tuna-bowl", "tuna-bowl"], new Map(MEALS.map((m) => [m.id, m])), FOODS);
    expect(r).toEqual({ tuna: 240, beans: 240 });
  });

  it("reports exactly what's missing, net of reservations", () => {
    const tuna = MEALS.find((m) => m.id === "tuna-bowl")!;
    const sf = shortfall(tuna, stock({ tuna: 120, beans: 100 }), { beans: 40 }, FOODS);
    expect(sf).toEqual([{ foodId: "beans", needG: 120, haveG: 60 }]);
    expect(isReady(tuna, stock({ tuna: 120, beans: 120 }), {}, FOODS)).toBe(true);
  });

  it("treats bought meals as always ready", () => {
    expect(isReady(MEALS.find((m) => m.bought)!, [], {}, FOODS)).toBe(true);
  });
});

describe("deal", () => {
  it("only deals ready meals", () => {
    const r = deal(base({ stock: stock({ oats: 500, milk: 1000, apple: 400 }) })); // no tuna, no beans
    expect(r.pick.breakfast).toBe("oats-bowl");
    expect(r.pick.lunch).toBe("takeaway"); // the only lunch that needs nothing from stock
  });

  it("won't give two slots the last tin", () => {
    const meals = [...MEALS, { ...MEALS[2], id: "tuna-2", slot: "snack" as const }];
    const r = deal(base({ meals, stock: stock({ oats: 500, milk: 1000, tuna: 120, beans: 960 }) }));
    const uses = [r.pick.lunch, r.pick.snack].filter((id) => id === "tuna-bowl" || id === "tuna-2");
    expect(uses.length).toBeLessThanOrEqual(1);
  });

  it("keeps locked slots and doesn't reserve them again", () => {
    const r = deal(base({ locked: ["breakfast"], current: { breakfast: "oats-bowl" }, stock: stock({ milk: 0, tuna: 120, beans: 480, apple: 400 }) }));
    expect(r.pick.breakfast).toBe("oats-bowl");
  });

  it("never deals hidden meals or meals with a food marked No", () => {
    const prefs = PREFS({ meals: { "oats-bowl": { state: "hidden" } }, foods: { tuna: "no" } });
    const r = deal(base({ prefs }));
    expect(r.pick.breakfast).toBeNull();
    expect(r.pick.lunch).not.toBe("tuna-bowl");
  });

  it("stays inside the budget", () => {
    // feta-bowl's 2.7 g would blow a 1 g budget; tuna-bowl's 0.3 g fits
    const r = deal(base({ budget: 1, meals: MEALS.filter((m) => m.slot === "lunch" && !m.bought) }));
    expect(r.pick.lunch).toBe("tuna-bowl");
  });

  it("returns a near-miss when nothing ready fits", () => {
    const r = deal(base({ stock: stock({ oats: 500, milk: 1000, apple: 400, tuna: 120, beans: 60 }), meals: MEALS.filter((m) => !m.bought) }));
    expect(r.pick.lunch).toBeNull();
    expect(r.nearMiss.lunch).toEqual({ mealId: "tuna-bowl", missing: 60 });
  });

  it("scores a recently-not-feeling-it meal lower", () => {
    const two = [...MEALS.filter((m) => m.slot !== "lunch"), MEALS[2], { ...MEALS[2], id: "tuna-bowl-b" }];
    const prefs = PREFS({ meals: { "tuna-bowl": { state: "kept", notFeelingUntil: "2026-10-20" } } });
    expect(deal(base({ meals: two, prefs })).pick.lunch).toBe("tuna-bowl-b");
  });

  it("doesn't change the reserved grams it was given", () => {
    const reservedGrams = { oats: 10 };
    deal(base({ reservedGrams }));
    expect(reservedGrams).toEqual({ oats: 10 });
  });
});

describe("nextFitting", () => {
  it("steps to the next ready meal that fits, wrapping round", () => {
    const o = base({ current: { breakfast: "oats-bowl", lunch: "tuna-bowl", snack: "apple" }, stock: stock({ oats: 500, milk: 1000, tuna: 120, beans: 480, feta: 100, apple: 400 }) });
    expect(nextFitting(o, "lunch", 1)).toBe("feta-bowl");
    expect(nextFitting(o, "lunch", -1)).toBe("takeaway");
  });

  it("skips meals that aren't ready or don't fit, and returns null if none do", () => {
    const o = base({ budget: 0.5, current: { breakfast: "oats-bowl", lunch: "tuna-bowl", snack: "apple" } });
    expect(nextFitting(o, "lunch", 1)).toBeNull();
  });
});
