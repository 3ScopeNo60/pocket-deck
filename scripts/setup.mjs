// Headless end-to-end check of Setup. Usage: node scripts/setup.mjs <out-dir>
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const out = process.argv[2] ?? ".";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 13"], hasTouch: true })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
const shot = (n) => p.screenshot({ path: path.join(out, `${n}.png`) });
await p.goto(pathToFileURL(path.resolve("dist-single/index.html")).href);
await p.waitForTimeout(900);

assert.ok(await p.locator(".setup").isVisible(), "Setup is the first thing a new phone sees");
assert.equal(await p.locator(".checkin").count(), 0);
await shot("s0-welcome");
await p.getByRole("button", { name: "Let's go" }).click();
await p.waitForTimeout(400);

// About you
await p.getByLabel("Weight").fill("92");
await p.getByLabel("Height").fill("181");
await p.getByLabel("Age").fill("41");
await shot("s1-about");
await p.getByRole("button", { name: "Use these numbers" }).click();
await p.waitForTimeout(400);

// Flavours
await p.getByRole("button", { name: "Spicy" }).click();
await p.getByRole("button", { name: "Warm-spiced" }).click();
await shot("s2-flavours");
await p.getByRole("button", { name: "Next" }).click();
await p.waitForTimeout(400);

// Foods: Tinder-style. No to the first (button), Try the second (button), swipe the third right,
// Like the rest with the button.
let firstNo = null, foodsSeen = 0;
for (let i = 0; i < 60; i++) {
  if (!(await p.locator(".swipe-hint").count())) break;
  if ((await p.locator(".setup-count").textContent()).includes("Meals")) break; // moved on; the last card is just fading out
  const name = (await p.locator(".swipe-name").textContent()).trim();
  if (process.env.DEBUG_SETUP) console.log("iter", i, name, (await p.locator(".setup-count").textContent()).trim());
  if (i === 0) { firstNo = name; await p.getByRole("button", { name: "Not for me" }).click(); }
  else if (i === 1) await p.getByRole("button", { name: "Willing to try" }).click();
  else if (i === 2) {
    const box = await p.locator(".swipe-card").boundingBox();
    const y = box.y + box.height / 2;
    await p.mouse.move(box.x + box.width / 2, y);
    await p.mouse.down();
    for (let k = 1; k <= 12; k++) await p.mouse.move(box.x + box.width / 2 + k * 22, y);
    await p.mouse.up();
  } else await p.getByRole("button", { name: "Like it" }).click();
  foodsSeen++;
  await p.waitForTimeout(420);
  // The next card must actually be on screen (it once mounted off to the side).
  const nb = await p.locator(".swipe-card").boundingBox();
  if (nb) assert.ok(nb.x >= -20 && nb.x + nb.width <= 410, `card ${foodsSeen + 1} is on screen (x=${Math.round(nb.x)})`);
  if (i === 3) {
    // Previous goes back one card.
    const before = await p.locator(".setup-count").textContent();
    await p.getByRole("button", { name: "Previous" }).click();
    await p.waitForTimeout(350);
    const after = await p.locator(".setup-count").textContent();
    assert.notEqual(before, after, "Previous moves back a card");
    console.log("previous:", before.trim(), "→", after.trim());
    const a = await p.getByRole("button", { name: "Like it" }).boundingBox();
    await p.waitForTimeout(100);
    const c = await p.getByRole("button", { name: "Like it" }).boundingBox();
    console.log("like button boxes", JSON.stringify(a), JSON.stringify(c));
    await p.getByRole("button", { name: "Like it" }).click({ timeout: 4000 });
    await p.waitForTimeout(420);
  }
}
console.log("foods answered:", foodsSeen, "| first No:", firstNo);
assert.ok(foodsSeen >= 25 && foodsSeen <= 40);
assert.ok((await p.locator(".swipe-card").boundingBox() ?? { height: 400 }).height > 300, "the card takes most of the screen");

// Meals: keep two, skip the rest.
await shot("s3-meals");
let kept = 0, skipped = 0;
for (let i = 0; i < 25; i++) {
  if (!(await p.getByRole("button", { name: "Keep it" }).count())) break;
  if (process.env.DEBUG_SETUP) console.log("meal iter", i, (await p.locator(".setup-count").textContent()).trim(), "kept", kept, "skipped", skipped);
  if (kept < 2) { await p.getByRole("button", { name: "Keep it" }).click(); kept++; }
  else { await p.getByRole("button", { name: "Not for me" }).click(); skipped++; }
  await p.waitForTimeout(520);
}
console.log("meals kept:", kept, "skipped:", skipped);
assert.equal(kept, 2);

// Medication then reminders.
// The time is a pair of scroll wheels: 08:30 by flicking each.
await p.getByLabel("Medication name").fill("TestTablet");
await p.getByRole("button", { name: "One more tablet" }).click();          // 2 tablets each time
await p.getByRole("button", { name: "Twice" }).click();                    // twice a day
await p.waitForTimeout(250);
const setWheels = (h, m) => p.evaluate(([hh, mm]) => {
  document.querySelector('.wheel[aria-label="Hour"]').scrollTop = 44 * hh;
  document.querySelector('.wheel[aria-label="Minutes"]').scrollTop = 44 * (mm / 5);
}, [h, m]);
await setWheels(7, 15);                                                     // first dose 07:15
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Second/ }).click();
await p.waitForTimeout(300);
await setWheels(21, 0);                                                     // second dose 21:00
await p.waitForTimeout(400);
await p.getByLabel("Strength").fill("10 mg");
await p.getByLabel("Tablets in a pack").fill("30");
await shot("s4-meds");
await p.getByRole("button", { name: "Save and continue" }).click();
await p.waitForTimeout(400);
await shot("s5-reminders");
await p.getByRole("button", { name: "Not now" }).click();
await p.waitForTimeout(400);
await shot("s6-done");
await p.getByRole("button", { name: "Start my day" }).click();
await p.waitForTimeout(800);
assert.ok(await p.locator(".checkin").isVisible(), "then the morning check-in");

// What was saved.
const prefs = (await rows("prefs"))[0];
assert.equal(prefs.setupDone, true);
assert.deepEqual([...prefs.flavours].sort(), ["spicy", "warm"]);
assert.equal(Object.values(prefs.foods).includes("no"), true);
assert.equal(Object.values(prefs.foods).filter((v) => v === "try").length >= 1, true);
assert.equal(Object.values(prefs.meals).filter((m) => m.state === "hidden").length, skipped);
const profile = (await rows("profile"))[0];
assert.equal(profile.weightKg, 92); assert.equal(profile.setUp, true);
const meds = await rows("meds");
assert.equal(meds.length, 1); assert.equal(meds[0].name, "TestTablet"); assert.equal(meds[0].pillsLeft, 30);
assert.deepEqual(meds[0].times, ["07:15", "21:00"], "each dose keeps its own time");
assert.equal(meds[0].perDose, 2, "tablets each time is saved");

// Today shows the doses.
await p.locator(".supper-opt", { hasText: "Fish" }).click();
await p.getByRole("button", { name: "Plan my day" }).click();
await p.waitForTimeout(800);
assert.match(await p.locator(".habit").first().innerText(), /0 of 2/, "two doses a day");
await p.locator(".habit").first().click();
await p.waitForTimeout(400);
assert.match(await p.locator(".habit").first().innerText(), /1 of 2/);
const med1 = (await rows("meds"))[0];
assert.equal(med1.pillsLeft, 28, "two tablets came off the pack");

// It isn't offered again, and meals he said No to never get dealt.
await p.reload();
await p.waitForTimeout(900);
assert.equal(await p.locator(".setup").count(), 0, "Setup doesn't repeat");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await b.close();
