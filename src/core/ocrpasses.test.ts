import { describe, expect, it } from "vitest";
import { isComplete, mergeReads, readUntilComplete } from "./ocrpasses";

const FULL = "Energy 100 kcal\nsaturated fat 1.0 g\nSodium 200 mg";

// The same tin as two passes read it: one garbled the energy and the decimal points, the other didn't.
const AUTO = `per 100g per Sigs sermng
Energy (ki) 59 197
Protein (g 174 9.6
Carbohydrate (Q) 1 <j
Total Fat (g) 1.3 07
of which saturated fat (g) 0.5 03
Dietary Fibre (Q) 0.0 0.0
Total Sodium (mg) 400 220`;
const BLOCK = `per 100.9. perShgsngeseng
Eneray (ku) 359 197
Protein (g) 17.4 9.6
Carbohydrate (Q) | <I
Total Fat (g) 13 0.7
of which saturated fat (g) 0.5 03
Dietary Fibre (Q) 0.0 0.0
Total Sodium (mg) 400 220`;

describe("mergeReads", () => {
  it("is just the parse for one text", () => {
    expect(mergeReads([FULL])).toMatchObject({ kcal: 100, sat: 1, sodium: 200, suspectEnergy: false });
  });
  it("reads the garbled heading and unit", () => {
    expect(mergeReads([BLOCK])).toMatchObject({ kcal: 86, sat: 0.5, sodium: 400 });
  });
  it("flags energy that doesn't fit the macros when no other pass can fix it", () => {
    const m = mergeReads([AUTO]);
    expect(m.suspectEnergy).toBe(true);
    expect(isComplete([AUTO])).toBe(false);
  });
  it("takes the energy that fits and the figures with their decimal points from the other pass", () => {
    const m = mergeReads([AUTO, BLOCK]);
    expect(m).toMatchObject({ kcal: 86, protein: 17.4, fat: 1.3, sat: 0.5, sodium: 400, suspectEnergy: false });
    expect(isComplete([AUTO, BLOCK])).toBe(true);
  });
});

describe("readUntilComplete", () => {
  it("stops at the first pass that has the three numbers and fits", async () => {
    let ran = 0;
    const r = await readUntilComplete([async () => (ran++, FULL), async () => (ran++, "x")]);
    expect(r).toMatchObject({ attempts: 1, complete: true });
    expect(ran).toBe(1);
  });
  it("goes on when a pass has the numbers but they don't add up", async () => {
    const r = await readUntilComplete([async () => AUTO, async () => BLOCK]);
    expect(r).toMatchObject({ attempts: 2, complete: true });
  });
  it("tries again and keeps what earlier passes read", async () => {
    const attempts: number[] = [];
    const r = await readUntilComplete(
      [async () => "Energy 100 kcal", async () => "Total Fat 5 g", async () => "saturated fat 1.0 g\nSodium 200 mg"],
      (n) => attempts.push(n),
    );
    expect(r).toMatchObject({ attempts: 3 });
    expect(attempts).toEqual([1, 2, 3]);
    expect(mergeReads(r.texts)).toMatchObject({ kcal: 100, fat: 5, sat: 1, sodium: 200 });
  });
  it("reports incomplete after every pass, with what it found", async () => {
    const r = await readUntilComplete([async () => "Energy 100 kcal", async () => "nothing"]);
    expect(r.complete).toBe(false);
    expect(r.attempts).toBe(2);
    expect(mergeReads(r.texts).kcal).toBe(100);
  });
  it("keeps going past a failing later pass, but not a failing first one", async () => {
    const ok = await readUntilComplete([async () => "Energy 100 kcal", async () => { throw new Error("boom"); }]);
    expect(mergeReads(ok.texts).kcal).toBe(100);
    await expect(readUntilComplete([async () => { throw new Error("boom"); }])).rejects.toThrow("boom");
  });
});
