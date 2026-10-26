import { describe, expect, it } from "vitest";
import { ownExtras, portionOn, portionWords, psylliumHabit, takenOn } from "./daily";

const h = psylliumHabit("2026-10-26");

describe("a daily habit in phases", () => {
  it("is nothing before it starts", () => {
    expect(portionOn(h, "2026-10-25")).toBeNull();
  });
  it("is a teaspoon for the first fourteen days", () => {
    expect(portionOn(h, "2026-10-26")).toMatchObject({ words: "1 tsp", dayNo: 1, phase: 0, daysLeft: 14 });
    expect(portionOn(h, "2026-11-08")).toMatchObject({ words: "1 tsp", dayNo: 14, daysLeft: 1 });
  });
  it("is a tablespoon after that, for good", () => {
    expect(portionOn(h, "2026-11-09")).toMatchObject({ words: "1 tbsp", dayNo: 15, phase: 1, daysLeft: null });
    expect(portionOn(h, "2027-03-01")!.portion).toEqual({ foodId: "psyllium", measure: "1 tsp", qty: 3 });
  });
  it("words a tablespoon as three teaspoons of whatever a teaspoon weighs", () => {
    expect(portionWords("1 tsp", 3)).toBe("1 tbsp");
    expect(portionWords("1 tsp", 6)).toBe("2 tbsp");
    expect(portionWords("1 tsp", 2)).toBe("2 tsp");
    expect(portionWords("1 cup", 2)).toBe("2 × 1 cup");
    expect(portionWords("1 tsp", 1)).toBe("1 tsp");
  });
  it("finds a day's tick, and keeps ticked habits out of the extras he added", () => {
    const extras = [{ kind: "Biscuits", size: "normal", at: "" }, { kind: "Psyllium husk, 1 tsp", size: "normal", at: "", dailyId: "daily-psyllium" }];
    expect(takenOn({ extras }, "daily-psyllium")?.kind).toBe("Psyllium husk, 1 tsp");
    expect(takenOn({ extras: [] }, "daily-psyllium")).toBeUndefined();
    expect(ownExtras(extras).map((x) => x.kind)).toEqual(["Biscuits"]);
  });
});
