import { describe, expect, it } from "vitest";
import { dayLabel, freshCount, groupReleases } from "./whatsnew";

const R = (id: string, date: string, ...notes: string[]) => ({ id, date, notes });
const releases = [R("c", "2026-10-15", "c1"), R("b", "2026-10-15", "b1", "b2"), R("a", "2026-10-14", "a1")];

describe("what's new", () => {
  it("puts the newest release first and folds the rest by day", () => {
    const g = groupReleases(releases, 1);
    expect(g.fresh.map((r) => r.id)).toEqual(["c"]);
    expect(g.days).toEqual([{ date: "2026-10-15", notes: ["b1", "b2"] }, { date: "2026-10-14", notes: ["a1"] }]);
  });
  it("shows every release since the last one seen as new", () => {
    expect(freshCount(releases, "a")).toBe(2);
    expect(freshCount(releases, "c")).toBe(1);
    expect(freshCount(releases, null)).toBe(1);
    expect(freshCount(releases, "zzz")).toBe(1);
    expect(groupReleases(releases, 2).fresh.map((r) => r.id)).toEqual(["c", "b"]);
  });
  it("labels days plainly", () => {
    expect(dayLabel("2026-10-15", "2026-10-15")).toBe("Earlier today");
    expect(dayLabel("2026-10-14", "2026-10-15")).toBe("Yesterday");
    expect(dayLabel("2026-10-09", "2026-10-15")).toBe("9 October");
  });
});
