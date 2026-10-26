// Me › My diet in plain words: his own limits, shareable. Usage: node scripts/diet.mjs <out-dir>  (needs dist-single/)
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors } = await launch();
await toToday(p);
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "My diet in plain words" }).click();
await p.waitForTimeout(500);
const body = await p.locator(".me-page").innerText();
assert.match(body, /bring my cholesterol down/);
assert.match(body, /Less saturated fat: about \d+(\.\d)? g a day at most/);
assert.match(body, /if you're cooking for me/i);
assert.match(body, /not advice for anyone else/);
assert.ok(await p.getByRole("button", { name: "Share" }).isVisible());
assert.ok(await p.getByRole("button", { name: "Copy the text" }).isVisible());
await p.screenshot({ path: path.join(out, "dt1-diet.png") });
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
