// A long or firm press doesn't select anything, and sideways asks to turn upright. Usage: node scripts/touch.mjs
import assert from "node:assert/strict";
import { launch, toToday } from "./_common.mjs";

const { browser, p, errors } = await launch();
await toToday(p);
const sel = (s) => p.evaluate((q) => getComputedStyle(document.querySelector(q)).userSelect, s);
assert.equal(await sel("body"), "none", "the page isn't selectable");
assert.equal(await sel(".hello"), "none");
await p.evaluate(() => { const i = document.createElement("input"); i.id = "probe"; document.body.appendChild(i); });
assert.equal(await sel("#probe"), "text", "fields still are");
// (-webkit-touch-callout is WebKit-only, so it is not visible to this Chromium run.)

// hold on the greeting for a second: nothing gets selected
const g = await p.locator(".hello").boundingBox();
await p.mouse.move(g.x + 20, g.y + 10);
await p.mouse.down();
await p.waitForTimeout(900);
await p.mouse.up();
assert.equal(await p.evaluate(() => String(window.getSelection())), "", "nothing selected");

// sideways
await p.setViewportSize({ width: 844, height: 390 });
await p.waitForTimeout(300);
assert.ok(await p.locator("#upright").isVisible(), "asks to turn upright");
assert.equal(await p.locator("#root").isVisible(), false);
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(300);
assert.equal(await p.locator("#upright").isVisible(), false);
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
