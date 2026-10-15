// Meal times under Me: the cards and the snack reminder follow them. Usage: node scripts/mealtimes.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await p.waitForTimeout(400);
assert.match(await p.locator('.card[aria-hidden="false"] .slot .pill').first().innerText(), /07:30/, "usual time to start with");

await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Meal times" }).click();
await p.waitForTimeout(300);
assert.match(await p.locator(".me-tile-txt small, .me-hero small").first().innerText(), /07:30 · 13:00 · 16:30/);

// Breakfast at 08:15, set by the two wheels.
await p.evaluate(() => {
  document.querySelector('.wheel[aria-label="Hour"]').scrollTop = 44 * 8;
  document.querySelector('.wheel[aria-label="Minutes"]').scrollTop = 44 * 3;
});
await p.waitForTimeout(900);
const prof = (await rows("profile"))[0];
assert.equal(prof.mealTimes.breakfast, "08:15");
await p.screenshot({ path: path.join(out, "mt1-page.png") });

// Lunch is a different chip and keeps its own time.
await p.getByRole("button", { name: /^Lunch/ }).click();
await p.waitForTimeout(400);
assert.equal((await rows("profile"))[0].mealTimes.lunch, "13:00");

// The card shows it.
await menuTo(p, "Today");
await p.waitForTimeout(600);
assert.match(await p.locator('.card[aria-hidden="false"] .slot .pill').first().innerText(), /08:15/, "the card shows the new time");

// And back to the usual.
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Meal times" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Back to the usual times" }).click();
await p.waitForTimeout(400);
assert.equal((await rows("profile"))[0].mealTimes.breakfast, "07:30");

// Reminders file uses the snack time.
const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Update calendar reminders" }).click()]);
assert.equal(download.suggestedFilename(), "pocket-deck-reminders.ics");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
