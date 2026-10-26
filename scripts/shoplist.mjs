// The shopping list: running out, sorted by why, urgency, and taking things off when restocked by hand.
// Usage: node scripts/shoplist.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch({ now: "2026-10-26T10:00:00" });
await toToday(p);
const putStock = (id, grams) => p.evaluate(({ id, grams }) => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => { const tx = o.result.transaction("stock", "readwrite"); tx.objectStore("stock").put({ itemId: id, kind: "food", grams, updatedAt: "2026-10-26T09:00:00Z" }, id); tx.oncomplete = () => res(null); };
}), { id, grams });

// Tahini is nearly gone: the list shows it under Running out, with a one-tap Add.
await putStock("tahini", 20);
await p.reload();
await p.waitForTimeout(1200);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "List" }).click();
await p.waitForTimeout(400);
const running = p.locator(".running");
assert.ok(await running.isVisible(), "a Running out section");
assert.ok(await running.getByText("Tahini").isVisible());
assert.match(await running.innerText(), /Running low, .* left/);
await p.screenshot({ path: path.join(out, "sl1-running.png") });
await running.getByRole("button", { name: "Add Tahini to the list" }).click();
await p.waitForTimeout(500);
assert.ok(await running.getByText("On list").first().isVisible(), "added to the list");

// Something he adds himself lands under "Added by you"; it can be sorted by aisle instead.
await p.getByRole("button", { name: "Add something" }).click();
await p.getByLabel("Search foods").fill("cinnamon");
await p.waitForTimeout(300);
await p.locator(".pick-list .krow:not(.add-new)", { hasText: "Cinnamon" }).first().click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Add to list" }).click();
await p.waitForTimeout(500);
const body = await p.locator(".k-section").innerText();
assert.match(body, /For your week · 1/i, "the running-out item is for the week");
assert.match(body, /Added by you · 1/i);
assert.ok(await p.locator(".aisle[data-group=mine]").getByText("Cinnamon").isVisible());
await p.getByRole("group", { name: "Sort the list" }).getByRole("button", { name: "By aisle" }).click();
await p.waitForTimeout(400);
assert.ok(await p.locator(".aisle-name", { hasText: "Spices & flavour" }).isVisible(), "by aisle");
await p.getByRole("group", { name: "Sort the list" }).getByRole("button", { name: "By why" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(out, "sl2-sorted.png") });

// Restocking one by hand offers to take it off the list.
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Restock" }).click();
await p.waitForTimeout(400);
await p.getByLabel("Search foods").fill("tahini");
await p.waitForTimeout(250);
await p.locator(".pick-list .krow:not(.add-new)", { hasText: "Tahini" }).click();
await p.waitForTimeout(400);
const off = p.getByRole("switch", { name: /Take it off the shopping list/ });
assert.ok(await off.isVisible(), "offers to take it off the list");
assert.equal(await off.getAttribute("aria-checked"), "true");
await p.screenshot({ path: path.join(out, "sl3-restock.png") });
await p.getByRole("button", { name: "Add to pantry" }).click();
await p.waitForTimeout(700);
await p.locator(".seg button", { hasText: "List" }).click();
await p.waitForTimeout(400);
const left = await rows("shopping");
assert.ok(!left.some((r) => r.itemId === "tahini"), "tahini came off the list");
assert.ok(left.some((r) => r.itemId === "cinnamon"), "the rest stays");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
