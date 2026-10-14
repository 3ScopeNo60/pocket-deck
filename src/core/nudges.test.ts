import { describe, expect, it } from "vitest";
import { backupDue, lookbackDue } from "./nudges";

describe("look-back", () => {
  it("is due on a Sunday with enough days", () => {
    expect(lookbackDue("2026-10-18", undefined, 5)).toBe(true);   // a Sunday
    expect(lookbackDue("2026-10-17", undefined, 5)).toBe(false);  // Saturday
    expect(lookbackDue("2026-10-18", undefined, 2)).toBe(false);  // too little to say
  });
  it("stays away once put away that Sunday", () => {
    expect(lookbackDue("2026-10-18", { lookbackOn: "2026-10-18" }, 5)).toBe(false);
    expect(lookbackDue("2026-10-25", { lookbackOn: "2026-10-18" }, 5)).toBe(true);
  });
});

describe("backup nudge", () => {
  it("waits until there's something to lose", () => {
    expect(backupDue("2026-10-14", undefined, undefined, 3).due).toBe(false);
    expect(backupDue("2026-10-14", undefined, undefined, 8).due).toBe(true);
  });
  it("asks again after a month, not before", () => {
    expect(backupDue("2026-10-14", "2026-10-01T10:00:00Z", undefined, 20).due).toBe(false);
    const late = backupDue("2026-10-14", "2026-09-01T10:00:00Z", undefined, 20);
    expect(late.due).toBe(true);
    expect(late.ageDays).toBe(43);
  });
  it("can be put away for a week", () => {
    expect(backupDue("2026-10-14", undefined, { backupUntil: "2026-10-21" }, 20).due).toBe(false);
    expect(backupDue("2026-10-22", undefined, { backupUntil: "2026-10-21" }, 20).due).toBe(true);
  });
});
