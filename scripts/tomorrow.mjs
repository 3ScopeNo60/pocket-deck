// Daytime done: tomorrow's prep and shopping, and telling supper now. Usage: node scripts/tomorrow.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, ctx, p, errors, rows } = await launch({ now: "2026-10-14T18:00:00" });
await toToday(p);

await p.waitForTimeout(800);
// Tomorrow's plan says overnight oats for breakfast, which is made tonight.
await p.evaluate(() => new Promise((res) => {
  const o = indexedDB.open("pocket-deck");
  o.onsuccess = () => {
    const t = o.result.transaction("week", "readwrite");
    t.objectStore("week").put({ weekOf: "2026-10-12", days: { "2026-10-15": { tonight: "normal", plan: { breakfast: "oats-overnight", lunch: null, snack: null } } } }, "2026-10-12");
    t.oncomplete = () => res(null);
  };
}));
await p.reload();
await p.waitForTimeout(1000);

// Eat everything that's dealt.
for (let i = 0; i < 4; i++) {
  const eat = p.locator('.card[aria-hidden="false"] .front .btn');
  if (!(await eat.count())) break;
  await eat.first().evaluate((el) => el.click());
  // the eaten card leaves before the next one is the only one showing
  await p.waitForFunction(() => document.querySelectorAll('.card[aria-hidden="false"]').length <= 1, null, { timeout: 8000 });
  await p.waitForTimeout(600);
}
await p.waitForTimeout(500);
assert.equal(await p.locator(".tomorrow").count(), 1, "the tomorrow screen replaces the old end card");
assert.match(await p.locator(".tomorrow h2").first().innerText(), /Daytime done/);
const meals = await p.locator(".tomorrow section").last().evaluate((el) => el.previousElementSibling?.textContent ?? "");
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(out, "tm1-done.png"), fullPage: true });

// Shopping: what's short for tomorrow goes on the list in one tap.
const addBtn = p.getByRole("button", { name: /^Add \d+ to your list$/ });
if (await addBtn.count()) {
  await addBtn.click();
  await p.waitForTimeout(600);
  assert.ok((await rows("shopping")).length > 0, "added to the list");
  assert.ok(await p.getByRole("button", { name: "On your list" }).isVisible());
} else {
  console.log("tomorrow needs nothing from the shop");
}

// Prep jobs tick on and off, and persist.
const prep = p.locator(".prep-row");
if (await prep.count()) {
  await prep.first().click();
  await p.waitForTimeout(400);
  const pd = (await rows("prefs"))[0].prepDone;
  assert.equal(pd.date, "2026-10-15");
  assert.equal(pd.ids.length, 1);
  await prep.first().click();
  await p.waitForTimeout(300);
  assert.equal((await rows("prefs"))[0].prepDone.ids.length, 0);
} else {
  assert.fail("overnight oats should show as tonight's prep");
}

// Tell supper now.
await p.getByRole("button", { name: "Tell me now" }).click();
await p.waitForTimeout(600);
await p.locator(".supper-opt", { hasText: "Nando" }).click();
await p.getByRole("button", { name: "Save", exact: true }).click();
await p.waitForTimeout(700);
const st = (await rows("prefs"))[0].supperTonight;
assert.equal(st.date, "2026-10-14");
assert.match(st.supperId, /nando/i);
assert.match(await p.locator(".supper-row").innerText(), /Nando/);
await p.screenshot({ path: path.join(out, "tm2-supper.png") });

// Next morning the check-in already has it.
await ctx.clock.setFixedTime(new Date("2026-10-15T08:00:00"));
await p.reload();
await p.waitForTimeout(1200);
assert.ok(await p.locator(".checkin").isVisible(), "check-in shows");
assert.equal(await p.locator(".supper-opt", { hasText: "Nando" }).getAttribute("aria-pressed"), "true", "last night's supper is pre-selected");
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(900);
const day = (await rows("days")).find((d) => d.date === "2026-10-15");
assert.match(day.lastNight.supperId, /nando/i);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
