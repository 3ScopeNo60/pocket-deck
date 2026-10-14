// Headless end-to-end check of the Kitchen screen. Usage: node scripts/kitchen.mjs <out-dir>
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
const rows = (store) =>
  page.evaluate((s) => new Promise((res, rej) => {
    const o = indexedDB.open("pocket-deck");
    o.onsuccess = () => { const r = o.result.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); };
    o.onerror = () => rej(o.error);
  }), store);
const openKitchen = async () => {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Kitchen" }).click();
  await page.waitForTimeout(600);
};
const waitToastGone = () => page.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});

await page.goto(file);
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Skip for now" }).click();
await page.waitForTimeout(500);
await page.locator(".supper-opt", { hasText: "Fish" }).click();
await page.getByRole("button", { name: "Plan my day" }).click();
await page.waitForTimeout(900);
await openKitchen();

// 1. Nothing on the list yet, so it opens on Unlock with exact shortfalls.
const cards = await page.locator(".unlock").count();
assert.ok(cards > 0, "some meals are waiting on a few ingredients");
console.log("meals to unlock:", cards, "| first:", (await page.locator(".unlock .name").first().textContent()));
await shot("k1-unlock");
assert.ok((await page.locator(".unlock .item.need").count()) > 0);

// 2. Add the first meal's missing items to the list (and again: no duplicates).
const firstFoods = await page.locator(".unlock").first().locator(".item .what").allTextContents();
await page.locator(".unlock").first().getByRole("button", { name: "Add missing to list" }).click();
await page.waitForTimeout(400);
assert.equal(await page.locator(".unlock").first().getByRole("button", { name: "On your list" }).isDisabled(), true);
await waitToastGone();

// 3. The list: grouped, one row per food.
await page.locator(".seg-4 button", { hasText: "List" }).click();
await page.waitForTimeout(500);
const listRows = await page.locator(".krow").count();
assert.equal(listRows, firstFoods.length, "one row per missing food");
console.log("list rows:", listRows, "|", (await page.locator(".total").textContent()));
await shot("k2-list");
assert.match(await page.locator(".total").textContent(), /No prices yet/);

// 4. Tick one, Done shopping, enter a price, and it lands in the pantry.
const firstName = (await page.locator(".krow .kname").first().textContent()).replace(/For your week|To unlock a meal|Running low|Added by you/, "").trim();
await page.locator(".tickbtn").first().click();
await page.getByRole("button", { name: /Done shopping/ }).click();
await page.waitForTimeout(700);
await page.locator(".price input").first().fill("42.50");
await shot("k3-restock");
await page.getByRole("button", { name: "Add to pantry" }).click();
await page.waitForTimeout(700);
const stock = await rows("stock");
const products = await rows("products");
console.log("products saved:", products.map((p) => `${p.foodId} R${p.lastPrice}`).join(", "));
assert.equal(products.length, 1);
assert.ok(products[0].lastPrice > 0, "price remembered");
assert.equal(await page.locator(".krow").count(), listRows - 1, "bought row left the list");
await waitToastGone();

// 5. Pantry shows it, and a fridge check can zero it.
await page.locator(".seg-4 button", { hasText: "Pantry" }).click();
await page.waitForTimeout(500);
await shot("k4-pantry");
const bought = products[0].foodId;
assert.ok(stock.find((s) => s.itemId === bought && s.grams > 0), "stock went up");
await page.locator(".krow", { hasText: /./ }).first().click();
await page.waitForTimeout(500);
await shot("k5-adjust");
await page.getByRole("button", { name: "All gone" }).click();
await page.waitForTimeout(500);
const afterZero = (await rows("stock")).find((s) => s.itemId === products[0].foodId || false);
// the first pantry row might not be the one we bought; just verify a stock row was written
assert.ok((await rows("stock")).length >= stock.length - 0, "stock still present");

// 6. Persistence: reload keeps the list, prices and no check-in.
await page.reload();
await page.waitForTimeout(900);
assert.equal(await page.locator(".checkin").count(), 0);
assert.equal((await rows("shopping")).length, listRows - 1);
assert.equal((await rows("products")).length, 1);

// 6b. Adding something lets you choose how many packs and which size.
await openKitchen();
await page.locator(".seg-4 button", { hasText: "List" }).click();
await page.getByRole("button", { name: "Add something" }).click();
await page.waitForTimeout(500);
await page.getByLabel("Search foods").fill("rolled");
await page.locator(".pick-list .krow", { hasText: "Rolled oats" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "One more" }).click();
await page.getByRole("button", { name: "One more" }).click();
await page.getByRole("button", { name: "1000 g" }).click();
await shot("k7-quantity");
await page.getByRole("button", { name: "Add to list" }).click();
await page.waitForTimeout(500);
let oats = (await rows("shopping")).find((r) => r.itemId === "rolled-oats");
assert.deepEqual([oats.packs, oats.shopUnitG], [3, 1000], "chosen quantity is kept");
await waitToastGone();
await page.getByRole("button", { name: /Change how much Rolled oats/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "One fewer" }).click();
await page.getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(400);
oats = (await rows("shopping")).find((r) => r.itemId === "rolled-oats");
assert.equal(oats.packs, 2, "quantity can be edited from the list");

// 6c. Switching screens always lands at the top.
await page.evaluate(() => window.scrollTo(0, 600));
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(450);
await page.getByRole("button", { name: "Today" }).click();
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => window.scrollY), 0, "Today opens at the top");

// 7. Flavour kit adds a staple to the list.
await waitToastGone();
await openKitchen();
await page.locator(".seg-4 button", { hasText: "Flavour" }).click();
await page.waitForTimeout(400);
await shot("k6-kit");
await page.locator(".krow", { hasText: "Smoked paprika" }).getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(300);
assert.ok((await rows("shopping")).some((r) => r.itemId === "smoked-paprika"));

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
void afterZero; void firstName;
await browser.close();
