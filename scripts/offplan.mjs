// "Had something else" and "+ Extra": logging food that wasn't on the plan. Usage: node scripts/offplan.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
const cardCount = () => p.locator('.card').count();
const allowance = async () => Number((await p.locator(".day-sat, .budget, .fit").first().innerText().catch(() => "0")).match(/[\d.]+/)?.[0] ?? 0);

const before = await cardCount();
const grip = p.locator('.card[aria-hidden="false"] .grip');
await grip.click({ position: { x: 60, y: 30 } });
await p.waitForTimeout(800);
await p.locator('.card[aria-hidden="false"] .back').getByText("Had something else").click();
await p.waitForTimeout(700);
assert.match(await p.locator(".sheet-title").innerText(), /What did you have for/);
await p.screenshot({ path: path.join(out, "op1-sheet.png") });
await p.locator(".checkin-opt", { hasText: "Pie from a bakery" }).click();
await p.getByRole("button", { name: "Big" }).click();
await p.getByRole("button", { name: "Save", exact: true }).click();
await p.waitForTimeout(900);

let day = (await rows("days"))[0];
assert.equal(day.replaced.length, 1);
assert.equal(day.replaced[0].what, "Pie from a bakery");
assert.equal(day.replaced[0].size, "big");
assert.equal(day.eaten.length, 0, "not recorded as the planned meal");
assert.equal(await p.locator(".done-row").count(), 1);
assert.match(await p.locator(".done-row").first().innerText(), /Pie from a bakery/);
assert.equal(await cardCount(), before - 1, "that slot's card is gone");
// Nothing came out of stock for the planned meal.
await p.screenshot({ path: path.join(out, "op2-replaced.png") });

// An extra on top.
await p.locator(".habit", { hasText: "Extra" }).click();
await p.waitForTimeout(600);
assert.match(await p.locator(".sheet-title").innerText(), /extra/i);
await p.locator(".checkin-opt", { hasText: "Chocolate" }).click();
await p.getByRole("button", { name: "Save", exact: true }).click();
await p.waitForTimeout(800);
day = (await rows("days"))[0];
assert.deepEqual(day.extras.map((x) => x.kind), ["Chocolate"]);
assert.equal(await p.locator(".extra-row").count(), 1);

// Typed text works too, and skipping.
await p.locator(".extra-row .link").click();
await p.waitForTimeout(500);
assert.equal((await rows("days"))[0].extras.length, 0, "extra removed");

// Undo brings the card back.
await p.locator(".done-row button").click();
await p.waitForTimeout(800);
assert.equal((await rows("days"))[0].replaced.length, 0);
assert.equal(await cardCount(), before);

// Skip a slot.
await grip.click({ position: { x: 60, y: 30 } });
await p.waitForTimeout(800);
await p.locator('.card[aria-hidden="false"] .back').getByText("Had something else").click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Skipped it" }).click();
await p.waitForTimeout(800);
day = (await rows("days"))[0];
assert.equal(day.replaced[0].size, "skipped");
assert.match(await p.locator(".done-row").first().innerText(), /Skipped/);

await p.reload();
await p.waitForTimeout(900);
assert.equal((await rows("days"))[0].replaced.length, 1, "kept after a reload");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
