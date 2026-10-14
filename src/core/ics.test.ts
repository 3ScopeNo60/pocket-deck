import { describe, expect, it } from "vitest";
import { buildIcs, fold } from "./ics";

const opts = { planTime: "18:00", snackTime: "16:30", tabletTime: "20:00", start: new Date(2026, 9, 14), now: new Date(Date.UTC(2026, 9, 14, 8, 0, 0)) };

describe("buildIcs", () => {
  const ics = buildIcs(opts);
  const lines = ics.split("\r\n");

  it("is a CRLF calendar with the timezone block and three events", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // no bare line feeds
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Africa/Johannesburg");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it("keeps wall-clock times (no UTC conversion) and the right recurrences", () => {
    expect(ics).toContain("DTSTART;TZID=Africa/Johannesburg:20261018T180000"); // next Sunday from Wed 14 Oct
    expect(ics).toContain("DTSTART;TZID=Africa/Johannesburg:20261014T163000");
    expect(ics).toContain("DTSTART;TZID=Africa/Johannesburg:20261014T200000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(ics.match(/RRULE:FREQ=DAILY/g)).toHaveLength(2);
  });

  it("uses stable UIDs and a relative alarm at the event time", () => {
    expect(ics).toContain("UID:pocket-deck-plan@local");
    expect(ics).toContain("UID:pocket-deck-snack@local");
    expect(ics).toContain("UID:pocket-deck-tablet@local");
    expect(ics.match(/TRIGGER:PT0S/g)).toHaveLength(3);
    expect(ics).toContain("DTSTAMP:20261014T080000Z");
  });

  it("makes one reminder per dose for a medication taken more than once a day", () => {
    const two = buildIcs({ ...opts, tabletTime: undefined, tabletTimes: ["08:00", "20:00"] });
    expect(two.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(two).toContain("UID:pocket-deck-tablet@local");
    expect(two).toContain("UID:pocket-deck-tablet-2@local");
    expect(two).toContain("T080000");
    expect(two).toContain("T200000");
  });

  it("omits the tablet when there's no time for it", () => {
    expect(buildIcs({ ...opts, tabletTime: undefined })).not.toContain("Tablet");
  });

  it("starts the Sunday event today when today is a Sunday", () => {
    expect(buildIcs({ ...opts, start: new Date(2026, 9, 18) })).toContain("DTSTART;TZID=Africa/Johannesburg:20261018T180000");
  });

  it("folds long lines at 75 octets, continuations start with a space, and rejoins losslessly", () => {
    const text = "SUMMARY:" + "Fibre snack 🍎 — plant sterols & beta-glucan, ".repeat(6);
    const parts = fold(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(text);
    expect(parts.join("")).not.toMatch(/\uFFFD/);
  });

  it("keeps every line of a real calendar within 75 octets", () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });

  it("rejects a malformed time", () => {
    expect(() => buildIcs({ ...opts, snackTime: "4:30pm" })).toThrow(/HH:MM/);
    expect(() => buildIcs({ ...opts, planTime: "25:00" })).toThrow();
  });
});
