// Checks a deployed (or locally served) build: installs, works offline, keeps your data.
// Usage: node scripts/deployed.mjs <url-with-trailing-slash>
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
const url = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));

await p.goto(url);
await p.waitForSelector(".setup");
console.log("title:", await p.title());

// The manifest and icons resolve, and the service worker takes control.
const manifestHref = await p.locator('link[rel="manifest"]').getAttribute("href");
const man = await (await ctx.request.get(new URL(manifestHref, url).href)).json();
assert.equal(man.display, "standalone");
for (const icon of man.icons) assert.equal((await ctx.request.get(new URL(icon.src, new URL(manifestHref, url)).href)).status(), 200, icon.src);
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload();
await p.waitForSelector(".setup");
assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), "service worker controls the page");

// Use it a little, then go offline and reload: it must still open, with the data.
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(400);
await p.locator(".supper-opt", { hasText: "Pasta" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(900);
await p.locator('.card[aria-hidden="false"] .front .btn').click();
await p.waitForTimeout(800);
assert.equal(await p.locator(".done-row").count(), 1);
await ctx.setOffline(true);
await p.reload();
await p.waitForSelector(".done-row", { timeout: 10000 });
assert.equal(await p.locator(".checkin").count(), 0, "offline: same day, no new check-in");
console.log("offline reload: ok, eaten meal still there");
await ctx.setOffline(false);
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await b.close();
