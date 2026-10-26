// Milk on oats is optional: with none in the pantry the meal is still on offer, counted without milk.
// Usage: node scripts/optional.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch({ now: "2026-10-26T09:00:00" });
await toToday(p);
// No milk at all, plenty of everything else.
await p.evaluate(() => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => {
    const tx = o.result.transaction("stock", "readwrite"); const st = tx.objectStore("stock");
    st.delete("milk-lowfat");
    for (const id of ["rolled-oats", "walnuts", "apple", "cinnamon"]) st.put({ itemId: id, kind: "food", grams: 3000, updatedAt: "2026-10-26T08:00:00Z" }, id);
    tx.oncomplete = () => res(null);
  };
}));
await p.reload();
await p.waitForTimeout(1200);
const stockOf = async (id) => (await rows("stock")).find((s) => s.itemId === id)?.grams;
assert.equal(await stockOf("milk-lowfat"), undefined);

// Log warm oats for yesterday's breakfast: it's on offer without milk, and is counted without it.
await menuTo(p, "Progress");
await p.locator('.dot[aria-label*="25 October"]').click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Fill in what you had/ }).click();
await p.waitForTimeout(600);
await p.locator(".back-slot", { hasText: "Breakfast" }).getByRole("button", { name: /Pick a meal|A different meal/ }).click();
await p.waitForTimeout(400);
await p.getByLabel("Search meals").fill("oats");
await p.waitForTimeout(300);
const oatsRow = p.locator(".pick-list .krow", { hasText: /warm/i }).first();
assert.ok(await oatsRow.isVisible(), "the oats meal is on offer");
await oatsRow.click();
await p.waitForTimeout(700);
const d = (await rows("days")).find((x) => x.date === "2026-10-25");
const e = d.eaten[0];
assert.deepEqual(e.left, ["milk-lowfat"], "recorded without milk");
assert.ok((await stockOf("rolled-oats")) < 3000, "the oats came out of the pantry");
assert.equal(await stockOf("milk-lowfat"), undefined, "no milk invented");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
