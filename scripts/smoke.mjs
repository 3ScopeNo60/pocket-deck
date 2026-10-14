// Headless end-to-end check of the Today screen on real data (iPhone-sized touch viewport).
// Usage: node scripts/smoke.mjs <out-dir>
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const out = process.argv[2] ?? ".";
const file = pathToFileURL(path.resolve("dist-single/index.html")).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
const topName = () => page.locator('.card[aria-hidden="false"] .name').textContent();
const dbRows = (store) =>
  page.evaluate((s) => new Promise((res, rej) => {
    const open = indexedDB.open("pocket-deck");
    open.onsuccess = () => {
      const r = open.result.transaction(s).objectStore(s).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    };
    open.onerror = () => rej(open.error);
  }), store);

await page.goto(file);
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Skip for now" }).click();
await page.waitForTimeout(500);

// 1. First open of the day: the check-in asks about last night.
assert.ok(await page.locator(".checkin").isVisible(), "check-in shows first");
assert.equal(await page.locator(".end").count(), 0, "no 'Daytime done' behind the check-in");
// Styling guard: the check-in's own stylesheet must be present (it was once deleted by accident).
const q = await page.locator(".checkin-q").evaluate((el) => { const c = getComputedStyle(el); return { font: c.fontFamily, size: parseFloat(c.fontSize), weight: c.fontWeight }; });
assert.match(q.font, /Bricolage/, "question uses the display font");
assert.ok(q.size >= 28 && Number(q.weight) >= 700, "question is set large and bold");
assert.equal(await page.locator(".checkin").evaluate((el) => getComputedStyle(el).position), "fixed");
await shot("1-checkin");
await page.locator(".supper-opt", { hasText: "Pasta" }).click();
await page.getByRole("button", { name: "Plan my day" }).click();
await page.waitForTimeout(900);
assert.equal(await page.locator(".checkin").count(), 0, "check-in closes");
console.log("outlook:", await page.locator(".fit").textContent());
const first = await topName();
console.log("first card:", first);
await shot("2-today");

// 2. Swipe the top card: a different, ready meal appears.
const grip = page.locator('.card[aria-hidden="false"] .grip');
const box = await grip.boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + box.width / 2, y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width / 2 - i * 18, y);
await page.mouse.up();
await page.waitForTimeout(900);
const second = await topName();
assert.notEqual(second, first, "swipe changes the meal");
console.log("after swipe:", second);

// 3. Flip the card to the steps side, tick a step.
await grip.click({ position: { x: 60, y: 30 } });
await page.waitForTimeout(900);
await shot("3-flipped");
await page.locator('.card[aria-hidden="false"] .step').first().click();
assert.equal(await page.locator('.card[aria-hidden="false"] .step').first().getAttribute("aria-pressed"), "true");
await grip.click({ position: { x: 60, y: 30 } });
await page.waitForTimeout(700);

// 4. Eat it: it moves to the Eaten list, and stock is deducted in the database.
const stockBefore = Object.fromEntries((await dbRows("stock")).map((r) => [r.itemId, r.grams]));
await page.locator('.card[aria-hidden="false"] .front .btn').click();
await page.waitForTimeout(900);
const stockAfter = Object.fromEntries((await dbRows("stock")).map((r) => [r.itemId, r.grams]));
const used = Object.keys(stockBefore).filter((k) => stockAfter[k] < stockBefore[k]);
assert.ok(used.length > 0, "eating takes ingredients out of stock");
console.log("stock used:", used.join(", "));
assert.equal(await page.locator(".done-row").count(), 1);
const days = await dbRows("days");
assert.equal(days.length, 1);
assert.equal(days[0].eaten.length, 1);
assert.equal(days[0].lastNight.supperId, "pasta");

// 5. Undo puts the stock back.
await page.locator(".done-row button").click();
await page.waitForTimeout(700);
const stockUndone = Object.fromEntries((await dbRows("stock")).map((r) => [r.itemId, r.grams]));
for (const k of used) assert.equal(stockUndone[k], stockBefore[k], `undo restores ${k}`);
await page.locator('.card[aria-hidden="false"] .front .btn').click();
await page.waitForTimeout(900);

// 6. Tonight sheet: heavy re-plans whatever is left and says so.
await page.locator(".supper-pill", { hasText: "Tonight" }).click();
await page.waitForTimeout(600);
await page.locator(".checkin-opt", { hasText: "Heavy" }).click();
await page.waitForTimeout(900);
console.log("after heavy:", await page.locator(".fit").textContent());
await shot("4-heavy");

// 7. Reload: no check-in again, same day, same eaten meal.
await page.reload();
await page.waitForTimeout(900);
assert.equal(await page.locator(".checkin").count(), 0, "check-in doesn't repeat");
assert.equal(await page.locator(".done-row").count(), 1, "eaten meal persisted");
console.log("tonight pill after reload:", await page.locator(".supper-pill").nth(1).textContent());

// 8. Empty kitchen: bought meals are still offered; others show what's missing.
await page.evaluate(() => new Promise((res) => {
  const open = indexedDB.open("pocket-deck");
  open.onsuccess = () => {
    const t = open.result.transaction(["stock", "days"], "readwrite");
    t.objectStore("stock").clear();
    const days = t.objectStore("days");
    const g = days.getAll();
    g.onsuccess = () => {
      for (const d of g.result) { d.eaten = []; d.plan = { breakfast: null, lunch: null, snack: null }; days.put(d, d.date); }
    };
    t.oncomplete = () => res();
  };
}));
await page.reload();
await page.waitForTimeout(900);
const text = await page.locator(".deck").innerText();
console.log("empty kitchen shows:", text.replace(/\s+/g, " ").slice(0, 120));
assert.ok(/Kauai/.test(text) || (await page.locator(".item.need").count()) >= 1, "empty kitchen still offers the bought meal or a near-miss");
await shot("5-empty-kitchen");
// "Add to list" on a near-miss card puts its missing foods on the shopping list.
const addBtn = page.getByRole("button", { name: "Add to list" });
if (await addBtn.count()) {
  await addBtn.first().click();
  await page.waitForTimeout(500);
  const listed = await dbRows("shopping");
  assert.ok(listed.length > 0, "near-miss Add to list fills the shopping list");
  console.log("on list:", listed.map((r) => r.itemId).join(", "));
}

// 9. Radial menu drag.
const core = await page.getByRole("button", { name: "Menu" }).boundingBox();
const cx = core.x + core.width / 2, cy = core.y + core.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(cx - i * 8, cy - i);
await page.mouse.up();
await page.waitForTimeout(400);
console.log("menu chose:", await page.locator("[data-sonner-toast]").first().textContent().catch(() => "none"));

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
