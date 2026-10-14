// Progress: day dots, day sheet, summaries and blood results. Usage: node scripts/progress.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, scenario, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);

// Before there's any history: an honest empty grid, nothing alarming.
await menuTo(p, "Progress");
assert.equal(await p.locator("button.dot-red").count(), 0, "no red days without history");
await p.screenshot({ path: path.join(out, "pr0-empty.png") });

await scenario(p, "A month of history");
assert.ok(await p.locator(".dots").isVisible(), "lands on Progress");
const cls = async (c) => p.locator(`.dot.${c}`).count();
const [none, green, yellow, red] = [await cls("dot-none"), await cls("dot-green"), await cls("dot-yellow"), await cls("dot-red")];
console.log("dots → none", none, "green", green, "yellow", yellow, "red", red, "| ticks", await p.locator(".dot-med").count());
assert.ok(none >= 1 && green >= 1 && yellow >= 1, "pale, green and yellow all appear");
assert.ok((await p.locator(".dot").count()) >= 28, "about five weeks of dots");
assert.ok((await p.locator(".dots .dot-med").count()) >= 1, "tablet checks show");
await p.screenshot({ path: path.join(out, "pr1-days.png") });

// Tap a green day: a short summary opens, with reasons.
await p.locator(".dot.dot-green").first().click();
await p.waitForTimeout(700);
assert.ok(await p.getByText("Went well").first().isVisible());
assert.match(await p.locator(".day-top").innerText(), /Score \d+ of 100/);
assert.ok((await p.locator(".reasons li").count()) >= 3);
await p.screenshot({ path: path.join(out, "pr2-daysheet.png") });
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// A pale day says nothing was recorded, and isn't scored.
await p.locator(".dot.dot-none").first().click();
await p.waitForTimeout(600);
assert.match(await p.locator(".day-top").innerText(), /No meals were ticked off/);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// Summary: week, then month, each with suggestions that are never more than three.
await p.locator(".seg button", { hasText: "Summary" }).click();
await p.waitForTimeout(500);
const weekHead = await p.locator(".week-summary b").textContent();
const sugg = await p.locator(".suggest").count();
assert.ok(sugg >= 1 && sugg <= 3, `1-3 suggestions (got ${sugg})`);
await p.locator(".seg button", { hasText: "Last 30 days" }).click();
await p.waitForTimeout(500);
const monthHead = await p.locator(".week-summary b").textContent();
console.log("week:", weekHead, "| month:", monthHead);
assert.notEqual(weekHead, monthHead);
assert.match(await p.locator(".k-sub", { hasText: "not medical advice" }).textContent(), /doctor/);
await p.screenshot({ path: path.join(out, "pr3-summary.png") });

// Results: the sample rows and a trend; add one in mmol/L and one in mg/dL.
// Results sit in a card at the bottom of the summary, with the full list one tap away.
assert.match(await p.locator(".blood-card").innerText(), /LDL .* mmol\/L on/);
await p.getByRole("button", { name: "See all 3" }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".lab-row").count(), 3);
assert.ok(await p.locator(".trend").isVisible(), "a trend line");
await p.getByRole("button", { name: "Add a result" }).click();
await p.waitForTimeout(500);
await p.getByLabel("LDL cholesterol").fill("3.2");
await p.getByLabel("Total", { exact: true }).fill("5.1");
await p.getByRole("button", { name: "Save result" }).click();
await p.waitForTimeout(600);
assert.equal(await p.locator(".lab-row").count(), 4);
assert.match(await p.locator(".lab-row").first().innerText(), /3\.2/);
assert.match(await p.locator(".lab-row").first().innerText(), /-0\.4/, "change since the previous result");
let labs = await rows("labs");
assert.equal(labs.length, 4);

// A result in mg/dL is stored as mmol/L, on another date so it doesn't replace today's.
await p.getByRole("button", { name: "Add a result" }).click();
await p.waitForTimeout(500);
await p.getByLabel("Date of the blood test").fill("2026-01-05");
await p.getByRole("button", { name: "mg/dL" }).click();
await p.getByLabel("LDL cholesterol").fill("120");
await p.getByRole("button", { name: "Save result" }).click();
await p.waitForTimeout(600);
labs = await rows("labs");
const mg = labs.find((l) => l.date === "2026-01-05");
assert.ok(mg && Math.abs(mg.ldl - 3.1) < 0.01, `120 mg/dL is 3.1 mmol/L (got ${mg?.ldl})`);
await p.screenshot({ path: path.join(out, "pr4-results.png") });

// Persists across a reload.
await p.reload();
await p.waitForTimeout(900);
assert.equal((await rows("labs")).length, 5);
assert.ok((await rows("days")).length >= 30);
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
