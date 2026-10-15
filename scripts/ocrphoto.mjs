// Feed a real photo of a label through the app's reader and print what it read.
// Usage: node scripts/ocrphoto.mjs <photo.jpg>      (needs a production build in dist/)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const photo = process.argv[2];
if (!photo) { console.error("give a photo path"); process.exit(1); }
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
const logs = [];
p.on("console", (m) => /\[ocr\]/.test(m.text()) && logs.push(m.text()));
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
await p.getByRole("button", { name: "Scan a label" }).click();
await p.waitForTimeout(400);
await p.locator(".sheet .krow").first().click();
await p.waitForTimeout(300);
const t0 = Date.now();
await p.getByLabel("Choose a photo").setInputFiles(photo);
await p.getByLabel("Energy").waitFor({ timeout: 120000 });
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const val = async (l) => (await p.getByLabel(l, { exact: true }).inputValue().catch(() => "?"));
console.log({ secs, kcal: await val("Energy"), sat: await val("Saturated fat"), sodium: await val("Sodium"), fibre: await val("Fibre"), logs });
await browser.close();
server.close();
