import { describe, expect, it } from "vitest";
import { buildInbox, unreadOf, type InboxInput } from "./inbox";

const base: InboxInput = {
  todayIso: "2026-10-14", updateId: null, newMealCount: 0, tomorrowNeeds: null, tomorrowDate: "2026-10-15",
  lowNames: [], med: null, lastLabDate: null, lookback: null, backup: { due: false, words: "" },
};

describe("inbox", () => {
  it("is empty when there's nothing to say", () => {
    expect(buildInbox(base)).toEqual([]);
  });

  it("lists what's worth knowing, in order", () => {
    const items = buildInbox({
      ...base, updateId: "b2", newMealCount: 3, tomorrowNeeds: ["Oat bran", "Onion"], lowNames: ["Olive oil"],
      med: { id: "m", pillsLeft: 6, perDay: 1 }, lastLabDate: "2026-02-10",
    });
    expect(items.map((x) => x.kind)).toEqual(["update", "newmeals", "shopping", "low", "refill", "labs"]);
    expect(items[1].title).toBe("3 new meals unlocked");
    expect(items[2].detail).toBe("Oat bran, Onion");
    expect(items[4].title).toBe("Tablets: 6 days left");
    expect(items.find((x) => x.kind === "labs")!.detail).toBe("Your last result was February 2026.");
  });

  it("stays quiet about a plentiful supply and a recent test", () => {
    const items = buildInbox({ ...base, med: { id: "m", pillsLeft: 40, perDay: 1 }, lastLabDate: "2026-08-01" });
    expect(items).toEqual([]);
  });

  it("only counts what hasn't been read", () => {
    const items = buildInbox({ ...base, updateId: "b2", newMealCount: 1 });
    expect(unreadOf(items, undefined)).toHaveLength(2);
    expect(unreadOf(items, ["update:b2"])).toHaveLength(1);
  });

  it("makes a refill unread again as the supply runs down", () => {
    const a = buildInbox({ ...base, med: { id: "m", pillsLeft: 6, perDay: 1 } })[0].id;
    const b = buildInbox({ ...base, med: { id: "m", pillsLeft: 2, perDay: 1 } })[0].id;
    expect(a).not.toBe(b);
  });
});
