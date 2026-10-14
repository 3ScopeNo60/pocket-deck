import { describe, expect, it } from "vitest";
import { mergeTime } from "./TimeWheel";

describe("mergeTime", () => {
  it("changes only the part a wheel reports, so two wheels can't overwrite each other", () => {
    let t = "20:00";
    t = mergeTime(t, { h: 8 });
    t = mergeTime(t, { m: 30 });
    expect(t).toBe("08:30");
    expect(mergeTime("08:30", { m: 5 })).toBe("08:05");
    expect(mergeTime("08:30", { h: 23 })).toBe("23:30");
  });
});
