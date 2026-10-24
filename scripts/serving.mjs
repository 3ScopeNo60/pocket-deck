// The serving size on a label becomes a measure for that food. Usage: node scripts/serving.mjs <out-dir>  (needs dist-single/)
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
await p.getByLabel("Search foods").fill("psyllium");
await p.waitForTimeout(250);
await p.locator(".sheet .krow", { hasText: "Psyllium" }).first().click();
await p.waitForTimeout(300);
await p.getByLabel("Label text").fill("Serving size: 1 tsp (3 g)\nPer 100 g\nEnergy 1000 kJ / 240 kcal\nSaturated fat 0.1 g\nDietary fibre 80 g\nSodium 50 mg");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Serving measure").inputValue(), "1 tsp", "serving measure read");
assert.equal(await p.getByLabel("Serving weight").inputValue(), "3", "serving weight read");
assert.ok(await p.getByText("count 1 tsp as 3 g").isVisible());
await p.screenshot({ path: path.join(out, "sv1-confirm.png") });
await p.getByRole("button", { name: "Save label" }).click();
await p.waitForTimeout(700);
const prod = (await rows("products")).find((x) => x.foodId === "psyllium");
assert.deepEqual(prod.serving, { label: "1 tsp", g: 3 }, "stored on the product");

// An own meal with a teaspoon of it counts 3 g, not 5.
const solOf = async () => {
  await p.locator(".seg button", { hasText: "Unlock" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Add your own meal" }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Add an ingredient" }).click();
  await p.getByLabel("Search foods").fill("psyllium");
  await p.waitForTimeout(300);
  await p.locator(".own-find .krow").first().click();
  await p.waitForTimeout(400);
  const t = await p.locator(".sheet .nums").innerText();
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  return t;
};
// fibre 80 -> soluble estimated at 71/85 of it = 66.8 per 100 g; 3 g -> 2.0 g (it was 3.5 g at 5 g of the old figure)
assert.match(await solOf(), /sol\. fibre\s*2\.0 g/i);

await p.reload();
await p.waitForTimeout(1200);
await menuTo(p, "Kitchen");
assert.match(await solOf(), /sol\. fibre\s*2\.0 g/i, "still 3 g after a reload");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
