// Card switcher: dots and peek bring another meal to the top. Usage: node scripts/switcher.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await p.waitForTimeout(500);

const topSlot = async () => (await p.locator('.card[aria-hidden="false"] .slot-name').first().innerText()).trim().toLowerCase();
const slotsLeft = async () => p.locator(".switch-dot").count();

assert.equal(await slotsLeft(), 3, "a dot for each meal still to come");
assert.equal(await topSlot(), "breakfast");
await p.screenshot({ path: path.join(out, "sw1-dots.png") });

// Tap the middle dot: lunch comes to the top.
const dots = p.locator(".switch-dot");
const box = async (i) => { const b = await dots.nth(i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
let c = await box(1);
await p.mouse.click(c.x, c.y);
await p.waitForTimeout(250);
await p.screenshot({ path: path.join(out, "sw2-mid-shuffle.png") });
await p.waitForTimeout(700);
assert.equal(await topSlot(), "lunch", "tapping the second dot brings lunch up");
await p.screenshot({ path: path.join(out, "sw3-lunch.png") });

// Hold and slide across: the snack, then back to breakfast.
c = await box(2);
await p.mouse.move((await box(1)).x, (await box(1)).y);
await p.mouse.down();
await p.mouse.move(c.x, c.y, { steps: 6 });
await p.waitForTimeout(700);
assert.equal(await topSlot(), "fibre snack");
const c0 = await box(0);
await p.mouse.move(c0.x, c0.y, { steps: 10 });
await p.waitForTimeout(700);
assert.equal(await topSlot(), "breakfast", "sliding back over the first dot");
await p.mouse.up();

// Only the top card is readable, and eating the one on top moves on.
await p.mouse.click((await box(2)).x, (await box(2)).y);
await p.waitForTimeout(900);
assert.equal(await topSlot(), "fibre snack");
await p.locator('.card[aria-hidden="false"] .front .btn').first().evaluate((el) => el.click());
await p.waitForFunction(() => document.querySelectorAll('.card[aria-hidden="false"]').length <= 1, null, { timeout: 8000 });
await p.waitForTimeout(700);
assert.equal(await slotsLeft(), 2, "two dots left");
assert.equal(await topSlot(), "breakfast", "back to the day's order");

// Peek mode: tap goes to the next; hold opens the list.
await menuTo(p, "Me");
await p.getByRole("button", { name: "Peek", exact: true }).click();
await p.waitForTimeout(300);
await menuTo(p, "Today");
await p.waitForTimeout(600);
const row = await p.locator(".switcher-row").boundingBox();
const rx = row.x + row.width / 2, ry = row.y + row.height / 2;
await p.mouse.click(rx, ry);
await p.waitForTimeout(800);
assert.equal(await topSlot(), "lunch", "a tap brings the next one up");
await p.mouse.move(rx, ry);
await p.mouse.down();
await p.waitForTimeout(500);
assert.ok(await p.locator(".peek").isVisible(), "holding opens the list");
assert.equal(await p.locator(".peek-row").count(), 2);
await p.screenshot({ path: path.join(out, "sw4-peek.png") });
const target = await p.locator(".peek-row", { hasText: /breakfast/i }).boundingBox();
await p.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 8 });
await p.waitForTimeout(200);
await p.mouse.up();
await p.waitForTimeout(900);
assert.equal(await topSlot(), "breakfast", "sliding up to a row and letting go chooses it");
assert.equal(await p.locator(".peek").count(), 0, "list is put away");

// And it's remembered.
assert.equal((await rows("prefs"))[0].switcher, "peek");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
