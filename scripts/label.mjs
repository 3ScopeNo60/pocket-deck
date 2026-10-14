// Label scanning: pasted text and a photo, then the numbers reach the food. Usage: node scripts/label.mjs <out-dir>
// The photo step needs a production build in dist/ (the OCR files live in public/ocr).
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const out = process.argv[2] ?? ".";
const dist = path.resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".traineddata": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = path.join(dist, u === "/" ? "index.html" : u);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", types[path.extname(f)] ?? "application/octet-stream");
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
await p.goto(url);
await p.waitForTimeout(1200);
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(500);
await p.locator(".supper-opt", { hasText: "Fish" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Menu" }).click();
await p.waitForTimeout(450);
await p.getByRole("button", { name: "Kitchen", exact: true }).click();
await p.waitForTimeout(500);
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(400);

// Pick a food, then paste the label text.
await p.getByRole("button", { name: "Scan a label" }).click();
await p.waitForTimeout(500);
await p.getByLabel("Search foods").fill("hummus");
await p.waitForTimeout(300);
if ((await p.locator(".krow").count()) === 0) { await p.getByLabel("Search foods").fill(""); }
const foodRow = p.locator(".sheet .krow").first();
const foodName = (await foodRow.locator(".kname").innerText()).trim();
await foodRow.click();
await p.waitForTimeout(300);
await p.getByLabel("Label text").fill("NUTRITIONAL INFORMATION\nPer 100 g | Per 30 g\nEnergy 1100 kJ / 263 kcal\nProtein 7 g\nTotal Fat 20 g\nof which saturated 2.9 g\nCarbohydrate 11 g\nDietary Fibre 4.1 g\nSodium 520 mg");
await p.getByRole("button", { name: "Read the text" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Energy").inputValue(), "263");
assert.equal(await p.getByLabel("Saturated fat").inputValue(), "2.9");
assert.equal(await p.getByLabel("Sodium").inputValue(), "520");
await p.getByRole("button", { name: "Save label" }).click();
await p.waitForTimeout(700);
let prod = (await rows("products")).find((x) => x.fromLabel);
assert.ok(prod, "label saved as a product");
assert.deepEqual([prod.per100.kcal, prod.per100.sat, prod.per100.na, prod.per100.fibre], [263, 2.9, 520, 4.1]);
assert.ok(prod.per100.sol >= 0 && prod.estimated.includes("sol"), "soluble fibre estimated and marked");
assert.ok(await p.getByText("Scanned labels").isVisible());
await p.screenshot({ path: path.join(out, "lb1-saved.png") });

// A photo: read on the phone.
await p.getByRole("button", { name: "Edit" }).first().click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Rescan" }).click();
await p.waitForTimeout(300);
await p.getByLabel("Choose a photo").setInputFiles(path.resolve("scripts/fixtures/label.png"));
await p.getByLabel("Energy").waitFor({ timeout: 90000 });
const e = await p.getByLabel("Energy").inputValue();
const s = await p.getByLabel("Saturated fat").inputValue();
const n = await p.getByLabel("Sodium").inputValue();
console.log("photo read:", { kcal: e, sat: s, sodium: n });
assert.equal(e, "251");
assert.equal(s, "2.4");
assert.equal(n, "480");
await p.screenshot({ path: path.join(out, "lb2-photo.png") });

// A restock keeps the label's numbers.
await p.getByRole("button", { name: "Save label" }).click();
await p.waitForTimeout(500);
prod = (await rows("products")).find((x) => x.fromLabel);
assert.deepEqual([prod.per100.kcal, prod.per100.sat, prod.per100.na], [251, 2.4, 480]);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
server.close();
