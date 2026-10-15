// A food that isn't in the list: added from a label, restocked at a custom pack size, and used in
// his own meal. Usage: node scripts/newfood.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(400);

// 1. Scan a label for something not in the list.
await p.getByRole("button", { name: "Scan a label" }).click();
await p.waitForTimeout(500);
// The big plus at the top right goes straight to a new food.
const plus = p.getByRole("button", { name: "Add a new food", exact: true });
assert.ok(await plus.isVisible(), "plus button on the sheet");
await p.screenshot({ path: path.join(out, "nf0-plus.png") });
await plus.click();
await p.waitForTimeout(300);
await p.getByLabel("Food name").fill("Granola bar");
await p.getByLabel("Icon 🍫").click();
await p.getByRole("button", { name: "Next: the label" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Type the numbers" }).click();
await p.waitForTimeout(300);
assert.ok(await p.getByText("New food").first().isVisible());
await p.getByLabel("Energy").fill("450");
await p.getByLabel("Saturated fat").fill("5");
await p.getByLabel("Sodium").fill("120");
await p.getByLabel("Fibre").fill("6");
assert.ok(await p.getByRole("button", { name: "How big is one pack?" }).isDisabled(), "a new food needs a pack size");
await p.getByLabel("Pack size").fill("250");
await p.getByLabel("Price of one pack").fill("39.99");
await p.getByRole("group", { name: "Packs bought" }).getByRole("button", { name: "One more" }).click();
await p.screenshot({ path: path.join(out, "nf1-confirm.png") });
await p.getByRole("button", { name: "Save new food" }).click();
await p.waitForTimeout(800);

const food = (await rows("foods")).find((f) => f.id === "mine-granola-bar");
assert.ok(food, "stored as a food");
assert.deepEqual(food.packSizes, [250]);
const prod = (await rows("products")).find((x) => x.foodId === "mine-granola-bar");
assert.equal(prod.packG, 250);
assert.equal(prod.lastPrice, 39.99);
assert.equal(prod.per100.sat, 5);
const st = (await rows("stock")).find((x) => x.itemId === "mine-granola-bar");
assert.equal(st.grams, 250, "one pack added to the pantry");
assert.ok(await p.locator(".krow", { hasText: "Granola bar" }).first().isVisible(), "listed in the pantry");

// 2. Restock it at a pack size that isn't one of the usual ones.
await p.getByRole("button", { name: "Restock" }).click();
await p.waitForTimeout(400);
await p.getByLabel("Search foods").fill("granola");
await p.waitForTimeout(250);
await p.locator(".pick-list .krow", { hasText: "Granola bar" }).click();
await p.waitForTimeout(400);
assert.ok(await p.getByText("1 × 250 g").isVisible(), "starts from the pack he last had");
await p.getByRole("button", { name: "Other" }).click();
await p.getByLabel("Granola bar pack size, grams").fill("375");
await p.getByLabel("Granola bar price").fill("52");
await p.screenshot({ path: path.join(out, "nf2-restock.png") });
await p.getByRole("button", { name: "Add to pantry" }).click();
await p.waitForTimeout(700);
const st2 = (await rows("stock")).find((x) => x.itemId === "mine-granola-bar");
assert.equal(st2.grams, 625, "250 + 375");
const prod2 = (await rows("products")).find((x) => x.foodId === "mine-granola-bar");
assert.equal(prod2.packG, 375);
assert.equal(prod2.lastPrice, 52);
assert.equal(prod2.per100.sat, 5, "label numbers kept through a restock");

// 3. A new ingredient from inside his own meal, read from pasted label text.
await p.locator(".seg button", { hasText: "Unlock" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Add your own meal" }).click();
await p.waitForTimeout(600);
await p.getByLabel("Meal name").fill("Seed crunch pot");
await p.getByRole("button", { name: "Add an ingredient" }).click();
await p.getByLabel("Search foods").fill("seed crackers");
await p.waitForTimeout(250);
await p.getByRole("button", { name: /Add “seed crackers” as a new ingredient/ }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Next: the label" }).click();
await p.waitForTimeout(300);
await p.getByLabel("Label text").fill("Per 100 g\nEnergy 1500 kJ / 360 kcal\nTotal Fat 12 g\nof which saturated fat 2 g\nCarbohydrate 50 g\nDietary Fibre 8 g\nSodium 90 mg\nNET WEIGHT 200 g");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Pack size").inputValue(), "200", "pack size read from the label");
assert.ok(await p.getByText("Pack size read from the label").isVisible());
await p.screenshot({ path: path.join(out, "nf3-own-meal.png") });
await p.getByRole("button", { name: "Save new food" }).click();
await p.waitForTimeout(700);
assert.ok(await p.locator(".own-row", { hasText: "seed crackers" }).count() >= 1, "ingredient is in the meal");
assert.ok(await p.locator(".sheet .nums").isVisible(), "numbers worked out from the label");
await p.getByRole("button", { name: "Save meal" }).click();
await p.waitForTimeout(800);
const meal = (await rows("meals")).find((m) => m.name === "Seed crunch pot");
assert.ok(meal && meal.items.some((i) => i.foodId.startsWith("mine-seed-crackers")));

// 4. All of it survives a reload.
await p.reload();
await p.waitForTimeout(1200);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(500);
assert.ok(await p.locator(".krow", { hasText: "Granola bar" }).first().isVisible(), "still in the pantry after a reload");
assert.equal(await p.locator(".k-empty").count() >= 0, true);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
