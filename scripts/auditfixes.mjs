// The audit's label fixes in the real UI: a dry pack's table for a food kept cooked, a tin kept by
// drained weight, and the per-100 g column. Usage: node scripts/auditfixes.mjs <out-dir>  (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(400);
const product = async (id) => (await rows("products")).find((x) => x.foodId === id);
const pick = async (name) => {
  await p.getByRole("button", { name: "Scan a label" }).click();
  await p.waitForTimeout(500);
  await p.getByLabel("Search foods").fill(name);
  await p.waitForTimeout(250);
  await p.locator(".sheet .krow", { hasText: name }).first().click();
  await p.waitForTimeout(300);
};

// 1. Pearl barley's label is for the dry grain; the app keeps barley cooked (x3).
await pick("Cooked barley");
await p.getByLabel("Label text").fill("Per 100 g\nEnergy 1 470 kJ / 352 kcal\nProtein 9.9 g\nTotal fat 1.2 g\nof which saturated 0.24 g\nCarbohydrate 77.7 g\nDietary fibre 15.6 g\nSodium 12 mg");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Energy").inputValue(), "352");
assert.equal(await p.getByRole("button", { name: "Dry, as packed" }).getAttribute("aria-pressed"), "true", "defaults to dry for a food kept cooked");
assert.ok(await p.getByText(/divided by 3/).isVisible());
await p.screenshot({ path: path.join(out, "af1-barley.png") });
await p.getByRole("button", { name: "Save label" }).click();
await p.waitForTimeout(700);
let b = await product("barley-cooked");
assert.ok(Math.abs(b.per100.kcal - 352 / 3) < 0.05, `kcal per 100 g cooked is a third of the dry label's (got ${b.per100.kcal})`);
assert.ok(Math.abs(b.per100.sat - 0.08) < 0.01, "saturated fat too");
assert.ok(Math.abs(b.per100.fibre - 5.2) < 0.05, "fibre too");

// ...and a table for the cooked food is kept as typed.
await p.getByRole("button", { name: "Edit" }).first().click();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("button", { name: "Cooked" }).getAttribute("aria-pressed"), "true", "editing a saved label shows cooked numbers");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// 2. A 170 g tin of tuna is kept as drained fish (~120 g).
await pick("Tuna in water");
await p.getByLabel("Label text").fill("Per 100 g\nEnergy (kcal) 86\nSaturated fat (g) 0.5\nSodium (mg) 400\nNET WEIGHT 170 g");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.ok(await p.getByText(/about 120 g drained/).first().isVisible(), "says it will be kept as drained weight");
await p.getByRole("group", { name: "Packs bought" }).getByRole("button", { name: "One more" }).click();
await p.getByRole("button", { name: "Save label" }).click();
await p.waitForTimeout(700);
const t = await product("tuna-water");
assert.equal(t.packG, 120);
const stock = (await rows("stock")).find((s) => s.itemId === "tuna-water");
assert.equal(stock.grams >= 120, true, "one tin adds the drained weight, not 170 g");
assert.ok(stock.grams < 170 + 1000, "no tin-weight surprise");

// 3. A per-serving column printed first is not read as per 100 g.
await pick("Hummus");
await p.getByLabel("Label text").fill("Per serving (30 g) Per 100 g\nEnergy (kJ) 450 1500\nSaturated fat (g) 0.9 3.0\nSodium (mg) 90 300");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Saturated fat").inputValue(), "3");
assert.equal(await p.getByLabel("Sodium").inputValue(), "300");
assert.equal(await p.getByLabel("Energy").inputValue(), "359");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
