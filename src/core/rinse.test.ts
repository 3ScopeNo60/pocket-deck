import { describe, expect, it } from "vitest";
import { rinseStep, withRinse } from "./rinse";

describe("rinse", () => {
  it("words the step for one or several foods", () => {
    expect(rinseStep([])).toBeNull();
    expect(rinseStep(["Tuna in Salted Water"])).toBe("Drain and rinse the tuna in salted water first.");
    expect(rinseStep(["Tuna", "Chickpeas", "Beans"])).toBe("Drain and rinse the tuna, chickpeas and beans first.");
  });
  it("puts the step first, once", () => {
    const once = withRinse(["Mix it"], ["Tuna"]);
    expect(once).toEqual(["Drain and rinse the tuna first.", "Mix it"]);
    expect(withRinse(once, ["Tuna"])).toEqual(once);
    expect(withRinse(["Mix it"], [])).toEqual(["Mix it"]);
  });
});
