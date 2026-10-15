// Update notice: a newer published build raises a toast, "What's new" shows once. Usage: node scripts/update.mjs <out-dir>
// Needs a production build in dist/ (npm run build).
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const out = process.argv[2] ?? ".";
const dist = path.resolve("dist");
let served = JSON.parse(fs.readFileSync(path.join(dist, "version.json"), "utf8"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x").pathname;
  if (u === "/version.json") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(served)); }
  let f = path.join(dist, u === "/" ? "index.html" : u);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", types[path.extname(f)] ?? "application/octet-stream");
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(url);
await p.waitForTimeout(1200);
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(600);
await p.locator(".supper-opt", { hasText: "Fish" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(900);
const noToast = () => p.getByText("A new version is ready").count();
assert.equal(await noToast(), 0, "same build: no notice");

// Me shows which version is running, can check on demand, and replays the notes.
await p.getByRole("button", { name: "Menu" }).click();
await p.waitForTimeout(450);
await p.getByRole("button", { name: "Me", exact: true }).click();
await p.waitForTimeout(600);
await p.locator(".me-tile", { hasText: "This app" }).click();
await p.waitForTimeout(300);
assert.ok(await p.getByText("About this app").isVisible());
await p.getByRole("button", { name: "Check for updates" }).click();
await p.waitForTimeout(900);
assert.ok(await p.getByText("You're on the latest version").isVisible(), "says it's current");
await p.getByRole("button", { name: "What's new" }).click();
await p.waitForTimeout(600);
assert.ok(await p.locator(".sheet-title", { hasText: "What's new" }).isVisible(), "notes can be replayed");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// A newer build is published; the phone comes back to the app.
served = { ...served, id: "next-build", title: "Three new meals", notes: ["Three new meals to try", "A progress view"] };
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(1200);
assert.equal(await noToast(), 1, "newer build: notice shown");
await p.screenshot({ path: path.join(out, "up1-toast.png") });
// ...and it's in the bell too.
await p.locator(".bell").evaluate((el) => el.click());
await p.waitForTimeout(600);
assert.match(await p.locator(".inbox-item[data-kind=update]").innerText(), /new version is ready/i);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// A second return doesn't stack another toast.
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(800);
assert.equal(await noToast(), 1, "still one notice");

// "What's new" appears once after a build change, never on the very first install.
assert.equal(await p.locator(".sheet-title", { hasText: "What's new" }).count(), 0, "first install: no what's-new");
await p.evaluate(() => localStorage.setItem("pd-last-build", "older-build"));
await p.reload();
await p.waitForTimeout(1500);
assert.ok(await p.locator(".sheet-title", { hasText: "What's new" }).isVisible(), "what's new after an update");
await p.screenshot({ path: path.join(out, "up2-whatsnew.png") });
await p.reload();
await p.waitForTimeout(1200);
assert.equal(await p.locator(".sheet-title", { hasText: "What's new" }).count(), 0, "only once");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
server.close();
