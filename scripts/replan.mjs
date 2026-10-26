// When swiping finds nothing else, say why and offer to plan again; after ingredients are added, swiping works.
// Usage: node scripts/replan.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors } = await launch({ now: "2026-10-26T07:00:00" });
await toToday(p);
const name = async () => (await p.locator('.card[aria-hidden="false"] .name, .card[aria-hidden="false"] h2, .card[aria-hidden="false"] .title').first().innerText().catch(() => "")).trim();
const swipe = async () => {
  const box = await p.locator('.card[aria-hidden="false"] .grip').boundingBox();
  const y = box.y + box.height / 2;
  await p.mouse.move(box.x + box.width / 2, y);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(box.x + box.width / 2 - i * 18, y);
  await p.mouse.up();
  await p.waitForTimeout(900);
};
const stockTo = (fn) => p.evaluate((mode) => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => {
    const tx = o.result.transaction("stock", "readwrite"); const st = tx.objectStore("stock");
    if (mode === "empty") st.clear();
    tx.oncomplete = () => res(null);
  };
}), fn);

// An empty pantry: nothing else can be made, and it says so, with a way to plan again.
await stockTo("empty");
await p.reload();
await p.waitForTimeout(1200);
const before = await name();
await swipe();
const toastText = await p.locator("[data-sonner-toast]").first().innerText();
assert.match(toastText, /can be made from the pantry|no other|saturated-fat budget/i, "says why");
assert.ok(await p.locator("[data-sonner-toast] button", { hasText: "Plan again" }).isVisible(), "offers to plan again");
await p.screenshot({ path: path.join(out, "rp1-why.png") });
assert.equal(await name(), before, "the card stays put");
await p.locator("[data-sonner-toast] button", { hasText: "Plan again" }).click();
await p.waitForTimeout(900);
assert.ok(await p.locator("[data-sonner-toast]", { hasText: /Planned again|still the best plan/ }).first().isVisible(), "answers");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
