// Every nutrient marker: for a meal (card back) and for a day (Progress). Usage: node scripts/nutrients.mjs <out-dir>  (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, scenario, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors } = await launch();
await toToday(p);
await scenario(p, "A month of history");
await p.waitForTimeout(500);

// A day: Progress › a day with meals › All nutrients for the day.
const dot = p.locator(".dot.dot-green").first();
await dot.click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "All nutrients for the day" }).click();
await p.waitForTimeout(600);
const day = await p.locator(".sheet-body").innerText();
assert.ok(day.includes("Total fat") && day.includes("Cholesterol"), "day lists the markers");
assert.match(day, /of limit|of goal/);
assert.match(day, /only counted for saturated fat and sodium/);
await p.screenshot({ path: path.join(out, "nu2-day.png") });

await p.keyboard.press("Escape");
await p.waitForTimeout(500);
await menuTo(p, "Today");
await p.waitForTimeout(600);
// A meal: the card's back has an "All nutrients" button.
await p.locator('.card[aria-hidden="false"] .grip').click({ position: { x: 60, y: 30 } });
await p.waitForTimeout(800);
const back = p.locator('.card[aria-hidden="false"] .back');
await back.getByRole("button", { name: "All nutrients" }).evaluate((el) => el.click());
await p.waitForTimeout(600);
const body = await p.locator(".sheet-body").innerText();
for (const label of ["Energy", "Protein", "Carbohydrate", "of which total sugar", "Total fat", "of which saturated", "monounsaturated", "polyunsaturated", "Cholesterol", "Plant sterols", "Total fibre", "Soluble fibre", "Beta-glucan", "Sodium"]) {
  assert.ok(body.includes(label), `lists ${label}`);
}
assert.match(body, /% of limit/, "shows the share of the day's limit");
assert.match(body, /A \+ means/, "explains the plus and 'not known'");
await p.screenshot({ path: path.join(out, "nu1-meal.png") });
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
