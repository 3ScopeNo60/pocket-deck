// Sunday look-back and the monthly backup reminder. Usage: node scripts/nudges.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, scenario, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
// A Sunday.
const { browser, p, errors, rows } = await launch({ now: "2026-10-18T10:00:00" });
await toToday(p);
const openBell = async () => { await p.locator(".bell").evaluate((el) => el.click()); await p.waitForTimeout(600); };
await openBell();
assert.equal(await p.locator(".inbox-item[data-kind=lookback], .inbox-item[data-kind=backup]").count(), 0, "nothing to look back on yet");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

await scenario(p, "A month of history");
await menuTo(p, "Today");
await p.waitForTimeout(600);
await openBell();
assert.equal(await p.locator(".inbox-item[data-kind=lookback], .inbox-item[data-kind=backup]").count(), 2, "look-back and backup both listed");
assert.match(await p.locator(".inbox-item[data-kind=lookback]").innerText(), /your week/i);
assert.match(await p.locator(".inbox-item[data-kind=lookback]").innerText(), /went well/);
assert.match(await p.locator(".inbox-item[data-kind=backup]").innerText(), /haven't made a backup/);
await p.screenshot({ path: path.join(out, "nu1-today.png") });

await p.getByRole("button", { name: "Not now" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Remind me next week" }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".inbox-item[data-kind=lookback], .inbox-item[data-kind=backup]").count(), 0);
const prefs = (await rows("prefs"))[0];
assert.equal(prefs.nudges.lookbackOn, "2026-10-18");
assert.equal(prefs.nudges.backupUntil, "2026-10-25");

await p.reload();
await p.waitForTimeout(900);
await openBell();
assert.equal(await p.locator(".inbox-item[data-kind=lookback], .inbox-item[data-kind=backup]").count(), 0, "stays away after a reload");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
