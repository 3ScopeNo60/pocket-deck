// New meals unlocked by an update: preview, decide, integrate. Usage: node scripts/newmeals.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, scenario, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
const openBell = async () => { await p.locator(".bell").evaluate((el) => el.click()); await p.waitForTimeout(600); };
await openBell();
assert.equal(await p.locator(".inbox-item[data-kind=newmeals]").count(), 0, "no new meals announced on a normal day");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

await scenario(p, "Three new meals unlocked");
await openBell();
assert.match(await p.locator(".inbox-item[data-kind=newmeals]").innerText(), /3 new meals unlocked/);
const pending = (await rows("prefs"))[0];
const newIds = Object.entries(pending.meals).filter(([, v]) => v.state === "new").map(([k]) => k);
assert.equal(newIds.length, 3);

// (That a waiting meal is never dealt is covered by core/discover.test.ts.)

await p.getByRole("button", { name: "Preview" }).click();
await p.waitForTimeout(700);
assert.match(await p.locator(".newmeals-head").innerText(), /3 new meals unlocked/);
assert.match(await p.locator(".swipe-face").innerText(), /(You have everything|You'd need)/);
await p.screenshot({ path: path.join(out, "nm1-preview.png") });

await p.getByRole("button", { name: "Add to rotation" }).click();      // first: keep (button)
await p.waitForTimeout(600);
await p.getByRole("button", { name: "Not for me" }).click();           // second: put away
await p.waitForTimeout(600);
const box = await p.locator(".swipe-card").boundingBox();             // third: swipe right
const y = box.y + box.height / 2;
await p.mouse.move(box.x + box.width / 2, y);
await p.mouse.down();
for (let k = 1; k <= 12; k++) await p.mouse.move(box.x + box.width / 2 + k * 22, y);
await p.mouse.up();
await p.waitForTimeout(700);
assert.match(await p.locator(".setup-lede").innerText(), /2 meals added to your rotation/);
await p.screenshot({ path: path.join(out, "nm2-done.png") });
await p.getByRole("button", { name: "Done" }).click();
await p.waitForTimeout(600);

await openBell();
assert.equal(await p.locator(".inbox-item[data-kind=newmeals]").count(), 0, "gone from the bell once decided");
const after = (await rows("prefs"))[0].meals;
assert.deepEqual(newIds.map((id) => after[id].state), ["kept", "hidden", "kept"]);
assert.ok(!Object.values(after).some((m) => m.state === "new"));
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
