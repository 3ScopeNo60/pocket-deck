// Headless end-to-end check of the Week screen. Usage: node scripts/week.mjs <out-dir>
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const out = process.argv[2] ?? ".";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 13"], hasTouch: true })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
const menuTo = async (name) => { await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450); await p.getByRole("button", { name, exact: true }).click(); await p.waitForTimeout(600); };
await p.goto(pathToFileURL(path.resolve("dist-single/index.html")).href);
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(500);
await p.locator(".supper-opt", { hasText: "Fish" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(800);

await menuTo("Week");
await p.screenshot({ path: path.join(out, "w0-empty.png") });
await p.getByRole("button", { name: "Plan the week" }).click();
await p.waitForTimeout(800);
assert.equal(await p.locator(".day-card").count(), 7, "seven days are planned");
assert.equal(await p.locator(".day-card .day-meal").count(), 21);
const meals0 = await p.locator(".day-card").nth(0).locator(".kname").allTextContents();
console.log("summary:", (await p.locator(".week-summary").innerText()).replace(/\s+/g, " "));
await p.screenshot({ path: path.join(out, "w1-week.png") });

// Tap a meal: its ingredients, steps, boosters and numbers, as on the back of its card.
const firstMeal = p.locator(".day-card").nth(1).locator(".meal-open").first();
const firstName = (await firstMeal.locator(".kname").innerText()).split("\n")[0].trim();
await firstMeal.click();
await p.waitForTimeout(600);
assert.equal((await p.locator(".sheet-title").innerText()).trim(), firstName, "the sheet is for that meal");
const detail = (await p.locator(".sheet-body").innerText()).toLowerCase();
for (const part of ["what's in it", "how to make it", "the numbers"]) assert.ok(detail.includes(part), `shows ${part}`);
assert.ok((await p.locator(".sheet .items li").count()) >= 1, "lists the ingredients");
assert.ok((await p.locator(".sheet .steps-read li").count()) >= 1, "lists the steps");
await p.screenshot({ path: path.join(out, "w1b-meal.png") });
await p.getByRole("button", { name: "All nutrients" }).click();
await p.waitForTimeout(600);
assert.ok((await p.locator(".sheet-body").innerText()).includes("Cholesterol"), "All nutrients opens from here");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// Tag a night heavy: that day is re-dealt, and the tag is kept.
await p.locator(".day-card").nth(2).getByRole("button", { name: "Heavy" }).click();
await p.waitForTimeout(600);
assert.equal(await p.locator(".day-card").nth(2).getByRole("button", { name: "Heavy" }).getAttribute("aria-pressed"), "true");

// Swap one meal: only that day changes, and it's pinned.
const before = await p.locator(".day-card").nth(4).locator(".kname").allTextContents();
await p.locator(".day-card").nth(4).getByRole("button", { name: /Another lunch/ }).click();
await p.waitForTimeout(500);
const after = await p.locator(".day-card").nth(4).locator(".kname").allTextContents();
assert.notDeepEqual(before, after, "swap changes the meal");
assert.match(await p.locator(".day-card").nth(4).getAttribute("class"), /pinned/);
assert.deepEqual(await p.locator(".day-card").nth(0).locator(".kname").allTextContents(), meals0, "other days unchanged");

// Put the shopping on the list: it appears in Kitchen with packs.
await p.getByRole("button", { name: /Put it on my list/ }).click();
await p.waitForTimeout(700);
const list = await rows("shopping");
assert.ok(list.length > 3, "the week's shortfall is on the list");
assert.ok(list.every((r) => r.reason === "plan" && r.packs >= 1));
console.log("on list:", list.length, "rows");
assert.ok(await p.locator(".kitchen .krow").first().isVisible(), "lands in the Kitchen list");

// The week survives a reload.
await p.reload();
await p.waitForTimeout(900);
await menuTo("Week");
assert.equal(await p.locator(".day-card").count(), 7);
assert.equal(await p.locator(".day-card").nth(2).getByRole("button", { name: "Heavy" }).getAttribute("aria-pressed"), "true");
await p.screenshot({ path: path.join(out, "w2-reloaded.png") });
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await b.close();
