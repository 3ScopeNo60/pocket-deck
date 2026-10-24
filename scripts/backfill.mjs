// Fill in yesterday: meals, something else, skipped, supper, habits, extras, undo, and the bell's nudge.
// Usage: node scripts/backfill.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch({ now: "2026-10-24T09:00:00" });
await toToday(p);
const yesterday = "2026-10-23";
const dayRow = async (d) => (await rows("days")).find((x) => x.date === d);

// The bell stays quiet on a new install: nothing was being tracked before today.
await p.locator(".bell").evaluate((el) => el.click());
await p.waitForTimeout(500);
assert.equal(await p.locator(".inbox-item[data-kind=backlog]").count(), 0, "no nag on a new install");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// Progress › yesterday's dot › fill it in.
await menuTo(p, "Progress");
await p.locator('.dot[aria-label*="23 October"]').click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Fill in what you had" }).click();
await p.waitForTimeout(600);
assert.ok(await p.locator(".sheet-title", { hasText: "Fill in yesterday" }).isVisible());
assert.ok(await p.getByText("Breakfast, lunch and snack aren't recorded yet").isVisible());
await p.screenshot({ path: path.join(out, "bl1-home.png") });

// Breakfast: a library meal.
await p.locator(".back-slot", { hasText: "Breakfast" }).getByRole("button", { name: "Pick a meal" }).click();
await p.waitForTimeout(400);
const first = p.locator(".pick-list .krow").first();
const mealName = (await first.locator(".kname").innerText()).split("\n")[0].trim();
await first.click();
await p.waitForTimeout(600);
let d = await dayRow(yesterday);
assert.equal(d.eaten.length, 1, "breakfast recorded on yesterday");
assert.equal(d.eaten[0].slot, "breakfast");
assert.ok(await p.locator(".back-slot[data-done=true]", { hasText: mealName }).isVisible(), "shows what was logged");

// Lunch: something else. Snack: skipped.
await p.locator(".back-slot", { hasText: "Lunch" }).getByRole("button", { name: "Something else" }).click();
await p.waitForTimeout(400);
await p.locator(".checkin-opt").nth(1).click();
await p.getByRole("button", { name: "Save" }).click();
await p.waitForTimeout(500);
await p.locator(".back-slot", { hasText: "Snack" }).getByRole("button", { name: "Skipped" }).click();
await p.waitForTimeout(500);
d = await dayRow(yesterday);
assert.equal(d.replaced.length, 2);
assert.ok(d.replaced.some((r) => r.slot === "snack" && r.size === "skipped"));
assert.ok(await p.getByText("Every meal is recorded").isVisible());

// Supper that night is today's "last night" answer: already there from the check-in, and can be changed.
assert.ok(await p.locator(".back-slot", { hasText: "Supper" }).getByText("plate").isVisible(), "shows the supper from today's check-in");
const before = (await dayRow("2026-10-24")).lastNight.supperId;
await p.locator(".back-slot", { hasText: "Supper" }).getByRole("button", { name: "Change" }).click();
await p.waitForTimeout(400);
await p.locator(".supper-opt[aria-pressed=false]").first().click();
await p.getByRole("button", { name: "Save" }).click();
await p.waitForTimeout(500);
assert.notEqual((await dayRow("2026-10-24")).lastNight.supperId, before, "supper changed on today's last night");

// Habits and an extra.
await p.getByRole("switch").click();
await p.waitForTimeout(400);
assert.equal((await dayRow(yesterday)).walk, true);
await p.locator(".back-slot", { hasText: "Extras" }).getByRole("button", { name: "Add" }).click();
await p.waitForTimeout(400);
await p.locator(".checkin-opt").first().click();
await p.getByRole("button", { name: "Save" }).click();
await p.waitForTimeout(500);
assert.equal((await dayRow(yesterday)).extras.length, 1);
await p.screenshot({ path: path.join(out, "bl2-filled.png") });

// Done closes the sheet and says so.
assert.ok(await p.getByRole("button", { name: "Done", exact: true }).isVisible());

// Undo a meal.
await p.locator(".back-slot", { hasText: "Breakfast" }).getByRole("button", { name: "Undo" }).click();
await p.waitForTimeout(500);
assert.equal((await dayRow(yesterday)).eaten.length, 0);
assert.ok(await p.getByRole("button", { name: /Done · 1 meal still blank/ }).isVisible(), "says what's still blank");
await p.getByRole("button", { name: /Done/ }).click();
await p.waitForTimeout(600);
assert.ok(await p.getByText("Saved. A meal or two are still blank.").isVisible(), "confirms on Done");
assert.equal(await p.locator(".sheet").count(), 0, "Done closes the sheet");

// The day's dot now counts it, and the sheet can be reopened.
await p.locator('.dot[aria-label*="23 October"]').click();
await p.waitForTimeout(500);
assert.ok(await p.getByRole("button", { name: /what you had/i }).isVisible());
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// Older than two days: no way to change it.
await p.locator('.dot[aria-label*="20 October"]').click();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("button", { name: /what you had/i }).count(), 0, "three days back is read-only");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// With earlier tracking on record, the bell notices a day left open.
await p.evaluate(() => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => {
    const tx = o.result.transaction("days", "readwrite");
    tx.objectStore("days").delete("2026-10-23");
    tx.objectStore("days").put({ date: "2026-10-20", lastNight: null, tonight: "normal", plan: { breakfast: null, lunch: null, snack: null }, eaten: [], extras: [], replaced: [], walk: false }, "2026-10-20");
    tx.oncomplete = () => res(null);
  };
}));
await p.reload();
await p.waitForTimeout(1200);
await p.locator(".bell").evaluate((el) => el.click());
await p.waitForTimeout(600);
const item = p.locator(".inbox-item[data-kind=backlog]");
assert.match(await item.innerText(), /Yesterday isn't fully logged/);
await p.screenshot({ path: path.join(out, "bl3-bell.png") });
await item.getByRole("button", { name: "Fill it in" }).click();
await p.waitForTimeout(700);
assert.ok(await p.locator(".sheet-title", { hasText: "Fill in yesterday" }).isVisible(), "the bell opens the sheet");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
