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
  it("reads a tinned-fish panel as OCR returned it: unit in the heading, kJ read as kd, drained", () => {
    const p = parseLabel(`TYPICAL NUTRITIONAL INFORMATION (drained)
per 100 g perSoq sngesering
Energy (kd) 359 197
Protein (9 174 96
of which total sugar (g) 0.0 0.0
Total Fat (g) 13 0.7
of which saturated fat (g) 0.5 03
Dietary Fibre (g) 0.0 0.0
Total Sodium (rng) 400 220`);
    expect(p).toMatchObject({ kcal: 86, sat: 0.5, fibre: 0, sodium: 400, drained: true });
  });
  it("reads energy given as (kcal) in the heading", () => {
    expect(parseLabel("Energy (kcal) 86 47").kcal).toBe(86);
  });
  it("notices a rinse instruction", () => {
    expect(parseLabel("Drain and rinse before use").rinse).toBe(true);
    expect(parseLabel("Energy 100 kcal").rinse).toBe(false);
  });
  it("reads cholesterol and plant sterols when a pack prints them", () => {
    const p = parseLabel("Cholesterol 12 mg\nPlant sterols 0.8 g\nEnergy 100 kcal");
    expect(p.cholesterol).toBe(12);
    expect(p.sterols).toBe(800);
    expect(parseLabel("Cholesterol-lowering plant sterols 1.5 g").cholesterol).toBeUndefined();
    expect(parseLabel("Cholesterol-lowering plant sterols 1.5 g").sterols).toBe(1500);
  });
  describe("things the audit found", () => {
    it("never takes a mono- or polyunsaturated line for saturated fat", () => {
      expect(parseLabel("Energy 300 kcal\nMonounsaturated fat (g) 12.0\nSaturated fat (g) 3.0").sat).toBe(3);
      expect(parseLabel("Energy 300 kcal\nPolyunsaturated fat 6.1 g").sat).toBeUndefined();
      expect(parseLabel("Energy 300 kcal\nof which unsaturated fat 8 g\nof which saturated fat 4 g").sat).toBe(4);
    });
    it("reads a space as a thousands separator when one digit leads, not between columns", () => {
      const p = parseLabel("Energy (kJ) 1 650 495\nSodium (mg) 1 200 360");
      expect(p.kcal).toBe(394); // 1650 kJ
      expect(p.sodium).toBe(1200);
      expect(parseLabel("Sodium (mg) 480 144").sodium).toBe(480);
      expect(parseLabel("Energy 1 650 kJ / 394 kcal").kcal).toBe(394);
    });
    it("takes the per-100 g column when a per-serving column is printed first", () => {
      const p = parseLabel("Per serving (30 g) Per 100 g\nEnergy (kJ) 450 1500\nSaturated fat (g) 0.9 3.0\nSodium (mg) 90 300");
      expect(p).toMatchObject({ sat: 3, sodium: 300, kcal: 359 });
      // and the usual order still works
      expect(parseLabel("Per 100 g Per 30 g\nSaturated fat (g) 3.0 0.9").sat).toBe(3);
    });
    it("leaves a row blank rather than guess when the per-100 g column has no number", () => {
      expect(parseLabel("Per serving Per 100 g\nSaturated fat (g) 0.9").sat).toBeUndefined();
    });
    it("reads units from the heading", () => {
      expect(parseLabel("Sodium (g) 0.45").sodium).toBe(450);
      expect(parseLabel("Sodium 0.45").sodium).toBe(450);
      expect(parseLabel("Sodium (mg) 480").sodium).toBe(480);
      expect(parseLabel("Plant sterols (mg) 800").sterols).toBe(800);
      expect(parseLabel("Plant sterols 0.8 g").sterols).toBe(800);
    });
    it("keeps genuine two-decimal values", () => {
      expect(parseLabel("Saturated fat (g) 0.09").sat).toBe(0.09);
      expect(parseLabel("Total fat 12.39 g").fat).toBe(12.39);
      expect(parseLabel("Total fat 12.39").fat).toBe(12.3); // OCR's 'g' read as 9
    });
    it("only calls it per-100 g when the heading says so", () => {
      expect(parseLabel("NET 1100 g\nEnergy 100 kcal").basis).toBe("unknown");
      expect(parseLabel("Per 100 g\nEnergy 100 kcal").basis).toBe("per100");
    });
  });
});
