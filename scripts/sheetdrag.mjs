// A drag down inside a sheet's content must scroll, not close it; the handle still closes it.
// Usage: node scripts/sheetdrag.mjs <out-dir>   (needs dist-single/)
import assert from "node:assert/strict";
import { launch, menuTo, toToday } from "./_common.mjs";

const { browser, p, errors } = await launch();
await toToday(p);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Pantry" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Scan a label" }).click();
await p.waitForTimeout(700);
const sheet = p.locator(".sheet");
assert.ok(await sheet.isVisible());

const drag = async (selector, dy) => {
  const b = await p.locator(selector).first().boundingBox();
  const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, 20);
  await p.mouse.move(x, y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(x, y + (dy * i) / 10);
  await p.mouse.up();
  await p.waitForTimeout(600);
};

// Scroll the list down a little, then pull down on content: it scrolls back up, the sheet stays.
await p.locator(".sheet-body").evaluate((el) => { el.scrollTop = 120; });
await drag(".sheet .krow", 260);
assert.ok(await sheet.isVisible(), "a drag down in the content doesn't close the sheet");
// ...even from the top of the list.
await p.locator(".sheet-body").evaluate((el) => { el.scrollTop = 0; });
await drag(".sheet .krow", 300);
assert.ok(await sheet.isVisible(), "a drag down at the top of the content doesn't close it either");
// The handle still dismisses it.
await drag(".sheet-handle", 400);
assert.equal(await p.locator(".sheet").count(), 0, "dragging the handle closes it");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
