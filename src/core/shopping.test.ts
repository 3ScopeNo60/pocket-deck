import { describe, expect, it } from "vitest";
import { listFromShortfalls, packsFor } from "./shopping";
import { FOODS } from "./fixtures";

describe("packsFor", () => {
  it("handles nothing needed", () => expect(packsFor(0, [500, 1000])).toEqual({ packG: 500, count: 0 }));
  it("takes an exact pack", () => expect(packsFor(500, [500, 1000])).toEqual({ packG: 500, count: 1 }));
  it("rounds up to the smallest pack that covers it", () => expect(packsFor(620, [500, 1000])).toEqual({ packG: 1000, count: 1 }));
  it("uses several of the largest when nothing covers it", () => expect(packsFor(2300, [500, 1000])).toEqual({ packG: 1000, count: 3 }));
});

describe("listFromShortfalls", () => {
  it("merges the same food before rounding to packs", () => {
    const rows = listFromShortfalls(
      [{ foodId: "tuna", needG: 120, haveG: 0 }, { foodId: "tuna", needG: 120, haveG: 0 }, { foodId: "beans", needG: 120, haveG: 60 }],
      FOODS, "unlock",
    );
    expect(rows).toContainEqual({ itemId: "tuna", kind: "food", packs: 2, shopUnitG: 120, reason: "unlock" });
    expect(rows).toContainEqual({ itemId: "beans", kind: "food", packs: 1, shopUnitG: 500, reason: "unlock" });
  });
});
