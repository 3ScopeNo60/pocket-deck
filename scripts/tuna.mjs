// Two sides of one tin read into one label, marked as needing a rinse, and the list's hint.
// Usage: node scripts/tuna.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Scan a label" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Add a new food", exact: true }).click();
await p.waitForTimeout(300);
await p.getByLabel("Food name").fill("Tuna in salted water");
await p.getByRole("button", { name: "Next: the label" }).click();
await p.waitForTimeout(300);

// Side one: the table, as OCR read it (kJ as "kd", the unit in the heading).
await p.getByLabel("Label text").fill(`TYPICAL NUTRITIONAL INFORMATION (drained)
per 100 g per 55 g single serving
Energy (kd) 359 197
Protein (9 17.4 9.6
Total Fat (g) 1.3 0.7
of which saturated fat (g) 0.5 0.3
Dietary Fibre (g) 0.0 0.0
Total Sodium (mg) 400 220`);
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Energy").inputValue(), "86", "kJ in the heading is converted");
assert.equal(await p.getByLabel("Sodium").inputValue(), "400");
assert.equal(await p.getByLabel("Pack size").inputValue(), "", "no weight on this side");
assert.ok(await p.getByText("This table is for the drained food").isVisible());

// Side two: weight and the rinse instruction. The numbers already read stay.
await p.getByRole("button", { name: "Scan another side" }).click();
await p.waitForTimeout(300);
assert.ok(await p.getByText("Scan the other side").isVisible());
await p.getByLabel("Label text").fill("Tuna chunks in salted water\nNET WEIGHT 170 g\nDrain and rinse before use");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Pack size").inputValue(), "170", "pack size from the second side");
assert.equal(await p.getByLabel("Energy").inputValue(), "86", "first side's numbers kept");
assert.ok(await p.getByText("2 sides read").isVisible());
assert.equal(await p.getByRole("switch").getAttribute("aria-checked"), "true", "rinse instruction noticed");
await p.screenshot({ path: path.join(out, "tn1-confirm.png") });
await p.getByRole("button", { name: "Save new food" }).click();
await p.waitForTimeout(800);

const prod = (await rows("products")).find((x) => x.foodId === "mine-tuna-in-salted-water");
assert.equal(prod.packG, 170);
assert.equal(prod.needsRinse, true);
assert.equal(prod.per100.na, 400);
assert.equal(prod.per100.kcal, 86);

// The pantry tags it; the list suggests something that needs no rinse.
await p.getByRole("button", { name: "Restock" }).click();
await p.waitForTimeout(300);
await p.getByLabel("Search foods").fill("salted");
await p.locator(".pick-list .krow", { hasText: "Tuna in salted water" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Add to pantry" }).click();
await p.waitForTimeout(600);
assert.ok(await p.locator(".krow", { hasText: "Needs rinsing" }).first().isVisible(), "tagged in the pantry");
await p.locator(".seg button", { hasText: "List" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Add something" }).click();
await p.getByLabel("Search foods").fill("salted");
await p.locator(".pick-list .krow", { hasText: "Tuna in salted water" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Add to list" }).click();
await p.waitForTimeout(500);
assert.ok(await p.locator(".rinse-hint").first().isVisible(), "hint on the shopping list");
await p.screenshot({ path: path.join(out, "tn2-list.png") });

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
