import { describe, expect, it } from "vitest";
import { buildFood, newFoodProblem } from "./newfood";

const draft = { name: "Nutty Crunch Bar", emoji: "🍫", aisle: "Tins & dry goods", packG: 150, per100: { kcal: 480, sat: 6.2, na: 90, fibre: 7 } };

describe("new food from a label", () => {
  it("needs a name and a pack size", () => {
    expect(newFoodProblem({ ...draft, name: " " })).toMatch(/name/i);
    expect(newFoodProblem({ ...draft, packG: 0 })).toMatch(/pack/i);
    expect(newFoodProblem(draft)).toBeNull();
  });
  it("builds a real food with the label's numbers and a pack of the size given", () => {
    const f = buildFood(draft, new Set());
    expect(f.id).toBe("mine-nutty-crunch-bar");
    expect(f.mine).toBe(true);
    expect(f.packSizes).toEqual([150]);
    expect(f.per100).toMatchObject({ kcal: 480, sat: 6.2, na: 90, fibre: 7, sol: 0 });
    expect(f.measures["1 pack"]).toBe(150);
  });
  it("keeps ids unique", () => {
    expect(buildFood(draft, new Set(["mine-nutty-crunch-bar"])).id).toBe("mine-nutty-crunch-bar-2");
  });
});
