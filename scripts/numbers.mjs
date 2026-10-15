// The numbers are marked as estimates and explained. Usage: node scripts/numbers.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors } = await launch();
await toToday(p);
await p.waitForTimeout(500);
const grip = p.locator('.card[aria-hidden="false"] .grip');
await grip.click({ position: { x: 60, y: 30 } });
await p.waitForTimeout(800);
const back = p.locator('.card[aria-hidden="false"] .back');
assert.match(await back.locator(".nums").first().innerText(), /≈/, "figures are marked as approximate");
assert.match(await back.locator(".rough").innerText(), /close, not exact/);
await back.getByRole("button", { name: "How they're worked out" }).evaluate((el) => el.click());
await p.waitForTimeout(600);
assert.match(await p.locator(".sheet-title").innerText(), /How the numbers are worked out/);
assert.match(await p.locator(".sheet-body").innerText(), /USDA/);
assert.match(await p.locator(".sheet-body").innerText(), /isn't medical advice/);
await p.screenshot({ path: path.join(out, "nm-sheet.png") });
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "This app" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: /How the numbers work/ }).click();
await p.waitForTimeout(500);
assert.ok(await p.locator(".sheet-title", { hasText: "How the numbers" }).isVisible());
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
