// Medication editor under Me. Usage: node scripts/med.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Medication" }).click();
await p.waitForTimeout(300);

await p.getByRole("button", { name: "Add your medication" }).click();
await p.waitForTimeout(600);
assert.equal(await p.getByRole("button", { name: "Enter the name" }).count(), 1, "needs a name");
await p.getByLabel("Medication name").fill("Lipogen");
await p.getByLabel("Medication strength").fill("20 mg");
await p.screenshot({ path: path.join(out, "md1-form.png") });
await p.getByRole("button", { name: "Save", exact: true }).click();
await p.waitForTimeout(700);

let med = (await rows("meds"))[0];
assert.equal(med.name, "Lipogen");
assert.equal(med.dose, "20 mg");
assert.deepEqual(med.times, ["20:00"]);
assert.equal(med.perDose, 1);
assert.equal(med.pillsLeft, 0, "no box yet");
assert.match(await p.locator(".krow", { hasText: "Lipogen" }).innerText(), /Every day at 20:00/);

// The Tablet chip on Today uses it.
await menuTo(p, "Today");
await p.waitForTimeout(700);
assert.match(await p.locator(".habit").first().innerText(), /Lipogen/);
await p.locator(".habit").first().click();
await p.waitForTimeout(500);
med = (await rows("meds"))[0];
assert.ok((await rows("days"))[0].dosesTaken.length === 1, "dose ticked");

// The box arrives: edit the pack.
await menuTo(p, "Me");
await p.locator(".me-tile", { hasText: "Medication" }).click();
await p.waitForTimeout(300);
await p.locator(".krow", { hasText: "Lipogen" }).click();
await p.waitForTimeout(600);
await p.getByLabel("Tablets in a pack").fill("30");
await p.getByLabel("Tablets left").fill("30");
await p.getByRole("button", { name: "Save", exact: true }).click();
await p.waitForTimeout(600);
med = (await rows("meds"))[0];
assert.equal(med.packSize, 30);
assert.equal(med.pillsLeft, 30);

// Remove.
await p.locator(".krow", { hasText: "Lipogen" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Remove", exact: true }).click();
await p.waitForTimeout(600);
assert.equal((await rows("meds")).length, 0);
assert.equal(await p.getByRole("button", { name: "Add your medication" }).count(), 1);

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
