// Import an online order: pasted text and (with a path) real screenshots through the reader.
// Usage: node scripts/order.mjs <out-dir> [screenshot.png]     (needs a production build in dist/)
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const out = process.argv[2] ?? ".";
const shot = process.argv[3];
const dist = path.resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = path.join(dist, u === "/" ? "index.html" : u);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", types[path.extname(f)] ?? "application/octet-stream");
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
await p.goto(`http://127.0.0.1:${server.address().port}/`);
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

const openImport = async () => {
  await p.getByRole("button", { name: /Import an order/ }).click();
  await p.waitForTimeout(500);
};

// 1. Pasted text.
await openImport();
await p.getByLabel("Order text").fill(`16 items
Sub-total R597.24
Farmer's Choice Fresh Boneless & Skinless Chicken Thighs Per KG 700g
Qty: 1/1
61.37
Padkos Raw Almonds 100g
Qty: 1/1
34.99
Checkers Housebrand Light Meat Shredded Tuna In Water 170g
Qty: 3/3
56.99
Saikav Chick Peas 410g
Qty: 2/2
59.98
Sunlight Original Dishwashing Liquid 750ml
Qty: 1/1
36.99`);
await p.getByRole("button", { name: "Read the order" }).click();
await p.waitForTimeout(500);
assert.ok(await p.getByText("5 items read").isVisible());
await p.screenshot({ path: path.join(out, "or1-review.png") });
const tuna = p.getByLabel(/Tuna In Water 170g pack size/i);
assert.equal(await tuna.inputValue(), "120", "tin weight became drained weight");
assert.equal(await p.getByLabel(/Dishwashing Liquid 750ml what|What Sunlight/i).first().inputValue(), "", "non-food is left out");
await p.getByRole("button", { name: /Add 4 to the pantry/ }).click();
await p.waitForTimeout(800);

const stock = await rows("stock");
assert.equal(stock.find((s) => s.itemId === "tuna-water").grams, 360 + (stock.find((s) => s.itemId === "tuna-water").grams - 360), "tuna added");
const prods = await rows("products");
const t = prods.find((x) => x.foodId === "tuna-water");
assert.ok(Math.abs(t.lastPrice - 56.99 / 3) < 0.01, "price per tin");
assert.equal(t.packG, 120);
assert.equal(prods.find((x) => x.foodId === "almonds").lastPrice, 34.99);
assert.ok(!prods.find((x) => /dish/i.test(x.name)), "dish soap not imported");

// 2. A real screenshot through the reader.
if (shot) {
  await openImport();
  await p.getByLabel("Choose screenshots").setInputFiles(shot);
  await p.getByText(/items? read/).waitFor({ timeout: 120000 });
  const names = await p.locator(".order-name").allInnerTexts();
  console.log("screenshot lines:", names);
  const prices = await p.locator(".order-row .price input").evaluateAll((els) => els.map((e) => e.value));
  console.log("prices:", prices);
  assert.deepEqual(prices, ["61.37", "34.99", "36.99", "44.99", "56.99", "59.98"], "price column matched to its items");
  await p.screenshot({ path: path.join(out, "or2-photo.png") });
  assert.ok(names.length >= 4, "most items read from the screenshot");
  await p.getByRole("button", { name: "Back", exact: true }).click();
  console.log("what the reader saw:\n" + (await p.getByLabel("Order text").inputValue()));
}

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
server.close();
