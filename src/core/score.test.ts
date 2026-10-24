import { describe, expect, it } from "vitest";
import { foods, meals } from "./content";
import { scoreDay, summarise, stateWord, type Supper, type DayScore } from "./score";
import type { Day } from "./types";

const mealMap = new Map(meals.map((m) => [m.id, m]));
const foodMap = new Map(foods.map((f) => [f.id, f]));
const day = (over: Partial<Day> = {}): Day => ({ date: "2026-10-14", lastNight: null, tonight: "normal", plan: { breakfast: null, lunch: null, snack: null }, eaten: [], extras: [], replaced: [], walk: false, ...over });
const ate = (...ids: string[]) => ids.map((mealId, i) => ({ slot: (["breakfast", "lunch", "snack"] as const)[i], mealId, at: "08:00" }));
const light: Supper = { id: "light", name: "Something light", takeaway: false, sat: 3, na: 500 };
const braai: Supper = { id: "braai", name: "Braai", takeaway: false, sat: 14 * 1.35, na: 1400 * 1.35 };
const kfc: Supper = { id: "kfc", name: "KFC", takeaway: true, sat: 14, na: 2200 };
const base = { meals: mealMap, foods: foodMap, satCap: 17.5 };
const score = (d: Day, supper: Supper | null = null, med: { times: string[] } | null = null) => scoreDay({ ...base, day: d, supper, med });

const GOOD = ["oats-overnight", "chicken-salad", "apple-almonds"];

describe("scoreDay", () => {
  it("is white (nothing recorded) for a day with no meals, never a bad day", () => {
    const s = score(day());
    expect(s.state).toBe("none");
    expect(s.points).toBeNull();
    expect(stateWord(s)).toBe("Nothing recorded");
  });

  it("is green for a lean, fibre-rich day with a light supper", () => {
    const s = score(day({ eaten: ate(...GOOD) }), light);
    expect(s.state).toBe("green");
    expect(s.points!).toBeGreaterThanOrEqual(75);
    expect(s.anchors).toContain("betaGlucan");
  });

  it("is red when a big braai tops up an already full day", () => {
    const s = score(day({ eaten: ate("egg-toast", "kauai-falafel", "carrot-hummus") }), braai);
    expect(s.state).toBe("red");
    expect(s.points!).toBeLessThan(50);
    expect(s.notes.join(" ")).toMatch(/over the .* budget/);
  });

  it("the same daytime meals score better with a light supper than a heavy one", () => {
    const d = day({ eaten: ate(...GOOD) });
    expect(score(d, light).points!).toBeGreaterThan(score(d, braai).points!);
  });

  it("is never red or green on a single recorded meal", () => {
    const s = score(day({ eaten: ate("oats-overnight") }));
    expect(s.state).toBe("yellow");
    expect(s.slots).toBe(1);
    expect(stateWord(s)).toBe("Partly recorded");
    expect(s.notes[0]).toMatch(/partial/i);
  });

  it("holds a normal supper back from the budget when supper wasn't logged", () => {
    const unknown = score(day({ eaten: ate(...GOOD) }));
    expect(unknown.satBudget).toBe(10.5); // 17.5 − 7
    expect(score(day({ eaten: ate(...GOOD) }), light).satBudget).toBe(17.5);
    expect(unknown.notes.join(" ")).toMatch(/Supper wasn't logged/);
  });

  it("reports medication only when there is one, and whether every dose was taken", () => {
    expect(score(day({ eaten: ate(...GOOD) })).meds).toBeNull();
    const two = { times: ["08:00", "20:00"] };
    expect(score(day({ eaten: ate(...GOOD), dosesTaken: ["08:05"] }), null, two).meds).toEqual({ taken: 1, expected: 2, done: false });
    expect(score(day({ eaten: ate(...GOOD), dosesTaken: ["08:05", "20:10"] }), null, two).meds?.done).toBe(true);
    expect(score(day({ eaten: ate(...GOOD), tabletAt: "20:00" }), null, { times: ["20:00"] }).meds?.done).toBe(true); // old single-tick days
  });

  it("ignores meals no longer in the library instead of failing", () => {
    expect(() => score(day({ eaten: ate("oats-overnight", "a-meal-that-was-removed", "apple-almonds") }))).not.toThrow();
  });

  it("counts an unrecorded-nutrition 'something else' as an average meal, not zero", () => {
    const a = score(day({ eaten: ate(...GOOD) }));
    const b = score(day({ eaten: ate(...GOOD), replaced: [{ slot: "lunch", what: "pie", size: "normal", at: "13:00" }] }));
    expect(b.sat).toBeGreaterThan(a.sat);
  });
});

describe("summarise", () => {
  const week = (...days: DayScore[]) => summarise(days, mealMap, foodMap, "week");
  const good = score(day({ eaten: ate(...GOOD) }), light);
  const bad = score(day({ eaten: ate("egg-toast", "kauai-falafel", "carrot-hummus") }), kfc);
  const none = score(day());

  it("counts the colours and leads with what went well", () => {
    const s = week(good, good, bad, none, none, none, none);
    expect(s.counts.green).toBe(2);
    expect(s.counts.red).toBe(1);
    expect(s.counts.none).toBe(4);
    expect(s.recorded).toBe(3);
    expect(s.headline).toMatch(/2 went well/);
    expect(s.headline).toMatch(/3 of 7 days recorded/);
  });

  it("says to record more before suggesting anything on very little data", () => {
    const s = week(good, none, none);
    expect(s.suggestions).toEqual(["Record a few more days and this gets more useful."]);
  });

  it("suggests more fibre, beans and fewer takeaways when those are the problem", () => {
    const lowFibre = score(day({ eaten: ate("egg-toast", "tuna-chickpea".replace("tuna-chickpea", "pilchards-toast"), "carrot-hummus") }), kfc);
    const s = week(lowFibre, lowFibre, lowFibre, lowFibre);
    const text = s.suggestions.join(" ");
    expect(s.suggestions.length).toBeLessThanOrEqual(3);
    expect(text).toMatch(/fibre|takeaway|Beans/i);
    expect(s.takeaways).toBe(4);
  });

  it("flags a tablet missed on several days only when there is a medication", () => {
    const m = { times: ["20:00"] };
    const missed = score(day({ eaten: ate(...GOOD) }), light, m);
    const took = score(day({ eaten: ate(...GOOD), dosesTaken: ["20:00"] }), light, m);
    const s = week(missed, missed, missed, took);
    expect(s.medDays).toEqual({ taken: 1, expected: 4 });
    expect(s.suggestions.join(" ")).toMatch(/tablet was ticked on 1 of 4/);
    expect(week(good, good, good, good).medDays).toBeNull();
  });

  it("is kind when nothing needs changing", () => {
    const strong = score(day({ eaten: ate("oat-bran-porridge", "lentil-soup", "orange-walnuts"), walk: true, dosesTaken: ["20:00"] }), light, { times: ["20:00"] });
    const s = week(strong, strong, strong, strong);
    expect(s.counts.green).toBe(4);
    expect(s.suggestions.join(" ")).not.toMatch(/Record a few more/);
  });
});

describe("the audit's score fixes", () => {
  const week = (...days: DayScore[]) => summarise(days, mealMap, foodMap, "week");
  it("keeps the daytime totals apart from the ones with supper", () => {
    const withSupper = score(day({ eaten: ate(...GOOD) }), kfc);
    const without = score(day({ eaten: ate(...GOOD) }), null);
    expect(withSupper.daytimeSodium).toBe(without.daytimeSodium);
    expect(withSupper.daytimeSat).toBe(without.daytimeSat);
    expect(withSupper.sodium).toBeGreaterThan(withSupper.daytimeSodium + 2000);
  });
  it("describes averages as daytime, so a logged supper doesn't leak into them", () => {
    const a = week(score(day({ eaten: ate(...GOOD) }), kfc), score(day({ date: "2026-10-15", eaten: ate(...GOOD) }), null));
    expect(a.avgSodium).toBe(Math.round(score(day({ eaten: ate(...GOOD) })).daytimeSodium));
  });
  it("leaves days with one meal logged out of the averages", () => {
    const fullDay = score(day({ eaten: ate(...GOOD) }), light);
    const oneMeal = score(day({ date: "2026-10-15", eaten: ate("egg-toast") }), light);
    expect(oneMeal.slots).toBe(1);
    expect(week(fullDay, oneMeal).avgSodium).toBe(week(fullDay).avgSodium);
    // ...but when only partial days exist there's still something to show
    expect(week(oneMeal).avgSodium).toBeGreaterThan(0);
  });
});

