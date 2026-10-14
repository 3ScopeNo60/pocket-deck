import { describe, expect, it } from "vitest";
import { doctorSummary, toText } from "./doctor";
import { summarise } from "./score";

const empty = summarise([], new Map(), new Map(), "month");
const base = { today: "2026-10-14", days: 30, summary: empty, labs: [], med: null, satCap: 17.5 };

describe("doctor summary", () => {
  it("says so when there's nothing yet", () => {
    const d = doctorSummary(base);
    const t = toText(d);
    expect(t).toContain("No results entered yet.");
    expect(t).toContain("Nothing was recorded in this period.");
    expect(t).toContain("No medication entered.");
  });
  it("lists results in date order with the LDL change", () => {
    const d = doctorSummary({ ...base, labs: [{ date: "2026-09-01", ldl: 3.1, total: 5 }, { date: "2026-02-01", ldl: 4.2, hdl: 1.1, apoB: 1.1 }] });
    const rows = d.sections[0].rows;
    expect(rows[0]).toMatch(/February 2026.*LDL 4\.2.*HDL 1\.1.*ApoB 1\.1 g\/L/);
    expect(rows[1]).toMatch(/September 2026.*LDL 3\.1.*total 5\.0/);
    expect(rows[2]).toMatch(/down 1\.1 mmol\/L/);
  });
  it("reports medication adherence", () => {
    const summary = { ...empty, recorded: 20, days: 30, medDays: { taken: 24, expected: 30 }, movedDays: 12 };
    const d = doctorSummary({ ...base, summary, med: { name: "Rosuvastatin", dose: "10 mg", times: ["20:00"], perDose: 1 } });
    const t = toText(d);
    expect(t).toContain("Rosuvastatin 10 mg, 1 time a day.");
    expect(t).toContain("24 of 30 days (80%)");
    expect(t).toContain("Moved on 12 of 30 days.");
  });
});
