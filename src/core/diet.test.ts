import { describe, expect, it } from "vitest";
import { dietExplainer } from "./diet";

const base = { satCap: 17.5, sodiumMax: 2000, solMin: 10, onMedication: false };

describe("the diet in plain words", () => {
  it("uses his own limits", () => {
    const d = dietExplainer(base);
    expect(d.text).toContain("17.5 g a day at most");
    expect(d.text).toContain("about 10 g a day");
    expect(d.text).toContain("2 000 mg".replace(" ", " ")) ;
  });
  it("turns sodium into salt", () => {
    expect(dietExplainer(base).text).toMatch(/about 5 g of salt/);
    expect(dietExplainer({ ...base, sodiumMax: 1500 }).text).toMatch(/about 3\.8 g of salt/);
  });
  it("mentions the tablet only when he takes one", () => {
    expect(dietExplainer(base).closing).not.toMatch(/tablet/);
    expect(dietExplainer({ ...base, onMedication: true }).closing).toMatch(/daily tablet my doctor gave me/);
  });
  it("is plain text he can paste: sections, bullets, no markup", () => {
    const t = dietExplainer(base).text;
    expect(t.startsWith("I'm eating to bring my cholesterol down")).toBe(true);
    expect(t).toContain("\nIf you're cooking for me\n•");
    expect(t).not.toMatch(/[<>*#]/);
  });
  it("says it's for his situation, not advice", () => {
    expect(dietExplainer(base).closing).toMatch(/not advice for anyone else/);
  });
});
