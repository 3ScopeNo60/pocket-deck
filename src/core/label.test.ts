import { describe, expect, it } from "vitest";
import { parseLabel } from "./label";

const LABEL = `NUTRITIONAL INFORMATION
Per 100 g | Per 30 g serving
Energy 1050 kJ / 251 kcal | 315 kJ
Protein 8,5 g | 2.6 g
Carbohydrate 12.3 g
of which sugars 3.1 g
Total Fat 18.2 g
of which saturated fat 2.4 g
Dietary Fibre 5.0 g
Sodium 480 mg | 144 mg`;

describe("parseLabel", () => {
  it("reads a typical per-100 g table", () => {
    const p = parseLabel(LABEL);
    expect(p).toMatchObject({ kcal: 251, protein: 8.5, carbs: 12.3, sugar: 3.1, fat: 18.2, sat: 2.4, fibre: 5, sodium: 480, basis: "per100" });
    expect(p.found.length).toBe(8);
  });
  it("keeps saturated fat apart from total fat, whichever line comes first", () => {
    const p = parseLabel("Saturated fat 6.0 g\nFat 20 g");
    expect(p.sat).toBe(6);
    expect(p.fat).toBe(20);
  });
  it("converts kJ and salt when that's all there is", () => {
    const p = parseLabel("Energy 1674 kJ\nSalt 1.25 g");
    expect(p.kcal).toBe(400);
    expect(p.sodium).toBe(500);
  });
  it("copes with OCR noise and less-than signs", () => {
    const p = parseLabel("Energy 8O kcal\nSodium <5 mg\nFat <0.5 g\nProtein  2 .1 g");
    expect(p.kcal).toBe(80);
    expect(p.sodium).toBe(5);
    expect(p.fat).toBe(0.5);
  });
  it("leaves unread fields undefined and never throws on junk", () => {
    const p = parseLabel("hello\n\n???");
    expect(p.found).toEqual([]);
    expect(p.basis).toBe("unknown");
    expect(() => parseLabel("")).not.toThrow();
  });

  it("drops the 9 OCR reads for a trailing g", () => {
    const p = parseLabel("Carbohydrate 12.39\nProtein 8.59\nFat 18.2 g");
    expect(p.carbs).toBe(12.3);
    expect(p.protein).toBe(8.5);
    expect(p.fat).toBe(18.2);
  });
  it("reads the pack size from the net weight or the e-mark", () => {
    expect(parseLabel("NET WEIGHT 425 g\nEnergy 100 kcal").packG).toBe(425);
    expect(parseLabel("Contents: 1,5 kg").packG).toBe(1500);
    expect(parseLabel("Best before 12/26\n500 g e").packG).toBe(500);
    expect(parseLabel("Per 100 g\nEnergy 100 kcal").packG).toBeUndefined();
  });
});
