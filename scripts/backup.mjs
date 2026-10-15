// Headless check of Back up and Restore. Usage: node scripts/backup.mjs
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
await p.goto(pathToFileURL(path.resolve("dist-single/index.html")).href);
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(400);
await p.locator(".supper-opt", { hasText: "Braai" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450);
await p.getByRole("button", { name: "Me", exact: true }).click(); await p.waitForTimeout(500);
await p.locator(".me-tile", { hasText: "Back up" }).click(); await p.waitForTimeout(400);
assert.match(await p.locator(".k-sub", { hasText: "Last backup" }).textContent(), /never/);

// Back up: a JSON file with every store.
const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Back up now/ }).click()]);
const file = path.join("/tmp", `pd-backup-${Date.now()}.json`);
await download.saveAs(file);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(data.app, "pocket-deck");
assert.equal(data.stores.days[0].lastNight.supperId, "braai");
assert.ok(data.stores.stock.length > 10);
assert.match(download.suggestedFilename(), /^pocket-deck-backup-\d{4}-\d{2}-\d{2}\.json$/);
await p.waitForTimeout(400);
assert.match(await p.locator(".k-sub", { hasText: "Last backup" }).textContent(), /today/);
const stockBefore = (await rows("stock")).length;

// Lose everything, then restore.
await p.evaluate(() => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const t = o.result.transaction(["stock", "days"], "readwrite"); t.objectStore("stock").clear(); t.objectStore("days").clear(); t.oncomplete = () => res(); }; }));
assert.equal((await rows("stock")).length, 0);
await p.locator('input[type="file"]').setInputFiles(file);
await p.waitForTimeout(400);
assert.ok(await p.getByText(/Replace everything on this phone/).isVisible(), "asks before replacing");
await p.getByRole("button", { name: "Replace everything" }).click();
await p.waitForTimeout(1500);
assert.equal((await rows("stock")).length, stockBefore, "stock is back");
assert.equal((await rows("days"))[0].lastNight.supperId, "braai", "the day is back");

// A file that isn't a backup is refused, and nothing changes.
fs.writeFileSync(file, '{"hello":"world"}');
await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450);
await p.getByRole("button", { name: "Me", exact: true }).click(); await p.waitForTimeout(500);
await p.locator(".me-tile", { hasText: "Back up" }).click(); await p.waitForTimeout(400);
await p.locator('input[type="file"]').setInputFiles(file);
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Replace everything" }).click();
await p.waitForTimeout(600);
assert.equal((await rows("stock")).length, stockBefore, "a bad file changes nothing");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await b.close();
