// A daily psyllium habit: set up in Me, ticked on Today, counted, taken from the pantry, and fillable for yesterday.
// Usage: node scripts/daily.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch({ now: "2026-10-26T09:00:00" });
await toToday(p);
const putStock = (id, grams) => p.evaluate(({ id, grams }) => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => { const tx = o.result.transaction("stock", "readwrite"); tx.objectStore("stock").put({ itemId: id, kind: "food", grams, updatedAt: "2026-10-26T08:00:00Z" }, id); tx.oncomplete = () => res(null); };
}), { id, grams });
const grams = async () => (await rows("stock")).find((s) => s.itemId === "psyllium")?.grams;
await putStock("psyllium", 200);
await p.reload();
await p.waitForTimeout(1200);

// Set it up: a teaspoon for 14 days, then a tablespoon, starting two days ago.
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Daily psyllium" }).click();
await p.waitForTimeout(400);
await p.getByRole("switch", { name: /Take psyllium husk every day/ }).click();
await p.waitForTimeout(300);
await p.getByLabel("Start date").fill("2026-10-24");
await p.waitForTimeout(400);
assert.match(await p.locator(".me-page").innerText(), /Today: 1 tsp \(day 3, 12 days to go before 1 tbsp\)/);
await p.screenshot({ path: path.join(out, "dy1-setup.png") });
const prefs = (await rows("prefs"))[0];
assert.equal(prefs.daily[0].phases[0].days, 14);
assert.equal(prefs.meals["psyllium-water"].state, "hidden", "the psyllium snack is set aside while the habit runs");

// Today: a chip; ticking it counts it and takes it out of the pantry; ticking again undoes it exactly.
await menuTo(p, "Today");
await p.waitForTimeout(500);
const chip = p.locator(".habit", { hasText: "Psyllium" });
assert.match(await chip.innerText(), /1 tsp · day 3 of 14/);
await chip.click();
await p.waitForTimeout(500);
assert.equal(await chip.getAttribute("aria-pressed"), "true");
assert.match(await chip.innerText(), /Taken · 1 tsp/);
const day = (await rows("days")).find((d) => d.date === "2026-10-26");
const x = day.extras.find((e) => e.dailyId === "daily-psyllium");
assert.deepEqual(x.food, { foodId: "psyllium", measure: "1 tsp", qty: 1 }, "counts as a portion of the food");
assert.equal(await grams(), 195, "a teaspoon (5 g) came out of the pantry");
assert.equal(await p.locator(".extra-row").count(), 0, "not listed as an extra");
await p.screenshot({ path: path.join(out, "dy2-today.png") });
await chip.click();
await p.waitForTimeout(500);
assert.equal(await grams(), 200, "taking it back puts back exactly that");
assert.equal((await rows("days")).find((d) => d.date === "2026-10-26").extras.some((e) => e.dailyId), false);

// Yesterday can be ticked too (it was part of the schedule).
await menuTo(p, "Progress");
await p.locator('.dot[aria-label*="25 October"]').click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Fill in what you had/ }).click();
await p.waitForTimeout(600);
const row = p.getByRole("switch", { name: /Psyllium, 1 tsp/ });
await row.click();
await p.waitForTimeout(500);
assert.equal(await row.getAttribute("aria-checked"), "true");
assert.ok((await rows("days")).find((d) => d.date === "2026-10-25").extras.some((e) => e.dailyId === "daily-psyllium"));
assert.equal(await grams(), 195);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// After the first fourteen days it's a tablespoon (three teaspoons).
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Daily psyllium" }).click();
await p.waitForTimeout(400);
await p.getByLabel("Start date").fill("2026-10-10");
await p.waitForTimeout(400);
assert.match(await p.locator(".me-page").innerText(), /Today: 1 tbsp every day from here on/);
await menuTo(p, "Today");
await p.waitForTimeout(400);
const chip2 = p.locator(".habit", { hasText: "Psyllium" });
assert.match(await chip2.innerText(), /1 tbsp a day/);
await chip2.click();
await p.waitForTimeout(500);
assert.equal(await grams(), 180, "a tablespoon is three teaspoons: 15 g more out");

// Turning it off brings the psyllium snack back.
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Daily psyllium" }).click();
await p.waitForTimeout(400);
await p.getByRole("switch", { name: /Take psyllium husk every day/ }).click();
await p.waitForTimeout(400);
assert.equal((await rows("prefs"))[0].meals["psyllium-water"].state, "kept");
assert.equal((await rows("prefs"))[0].daily.length, 0);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
