// Headless check of the preview-only scenarios. Usage: node scripts/scenarios.mjs
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 13"], hasTouch: true })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(pathToFileURL(path.resolve("dist-single/index.html")).href);
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Skip for now" }).click();
await p.waitForTimeout(500);
await p.locator(".supper-opt", { hasText: "Fish" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(800);
const toMe = async () => { await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450); await p.getByRole("button", { name: "Me", exact: true }).click(); await p.waitForTimeout(450); };
const run = async (title) => { await p.locator(".krow", { hasText: title }).click(); await p.waitForTimeout(800); };
const toast = () => p.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});

await toMe(); await run("Big braai");
assert.match(await p.locator(".fit").textContent(), /braai/i);
console.log("braai:", await p.locator(".fit").textContent());
await toast();

await toMe(); await run("Empty kitchen");
assert.ok(await p.locator(".k-empty, .unlock").first().isVisible());
console.log("empty kitchen unlock cards:", await p.locator(".unlock").count());
await toast();

await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450);
await p.getByRole("button", { name: "Me", exact: true }).click(); await p.waitForTimeout(450);
await run("Fully stocked");
assert.equal(await p.locator(".unlock").count(), 0, "everything ready when fully stocked");
await toast();

await p.getByRole("button", { name: "Menu" }).click(); await p.waitForTimeout(450);
await p.getByRole("button", { name: "Me", exact: true }).click(); await p.waitForTimeout(450);
await run("Start the day again");
assert.ok(await p.locator(".checkin").isVisible(), "check-in returns");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await b.close();
