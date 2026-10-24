import { describe, expect, it } from "vitest";
import { backfillDates, backlogNudge, blankDay, canBackfill, missingSlots, slotWords } from "./backfill";

const day = (date: string, over: Partial<ReturnType<typeof blankDay>> = {}) => ({ ...blankDay(date), ...over });

describe("backfill", () => {
  it("allows yesterday and the day before, not today", () => {
    expect(backfillDates("2026-10-24")).toEqual(["2026-10-23", "2026-10-22"]);
    expect(canBackfill("2026-10-23", "2026-10-24")).toBe(true);
    expect(canBackfill("2026-10-21", "2026-10-24")).toBe(false);
    expect(canBackfill("2026-10-24", "2026-10-24")).toBe(false);
    expect(backfillDates("2026-11-01")).toEqual(["2026-10-31", "2026-10-30"]);
  });
  it("finds the meals not recorded, counting swapped and skipped ones as recorded", () => {
    expect(missingSlots(undefined)).toEqual(["breakfast", "lunch", "snack"]);
    const d = day("2026-10-23", {
      eaten: [{ slot: "breakfast", mealId: "x", at: "07:30" }],
      replaced: [{ slot: "snack", what: "Skipped", size: "skipped", at: "16:30" }],
    });
    expect(missingSlots(d)).toEqual(["lunch"]);
  });
  it("words the missing slots", () => {
    expect(slotWords(["lunch"])).toBe("Lunch");
    expect(slotWords(["breakfast", "snack"])).toBe("Breakfast and snack");
    expect(slotWords(["breakfast", "lunch", "snack"])).toBe("Breakfast, lunch and snack");
  });
  it("nudges for the most recent open day, once tracking has begun", () => {
    const days = [day("2026-10-20"), day("2026-10-22", { eaten: [{ slot: "breakfast", mealId: "x", at: "" }] })];
    const n = backlogNudge("2026-10-24", days)!;
    expect(n.date).toBe("2026-10-23"); // yesterday has no record at all
    expect(n.when).toBe("Yesterday");
    expect(n.missing).toHaveLength(3);
  });
  it("falls back to the day before, and to nothing when both are done", () => {
    const full = (date: string) => day(date, { eaten: [{ slot: "breakfast", mealId: "x", at: "" }, { slot: "lunch", mealId: "x", at: "" }, { slot: "snack", mealId: "x", at: "" }] });
    const a = backlogNudge("2026-10-24", [day("2026-10-20"), full("2026-10-23"), day("2026-10-22")])!;
    expect(a.date).toBe("2026-10-22");
    expect(a.when).toBe("Thursday");
    expect(backlogNudge("2026-10-24", [day("2026-10-20"), full("2026-10-23"), full("2026-10-22")])).toBeNull();
  });
  it("doesn't nag a new install about days before it started", () => {
    expect(backlogNudge("2026-10-24", [])).toBeNull();
    expect(backlogNudge("2026-10-24", [day("2026-10-24")])).toBeNull();
  });
});
