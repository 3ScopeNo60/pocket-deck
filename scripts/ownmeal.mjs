// Add your own meal from Kitchen. Usage: node scripts/ownmeal.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Unlock" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Add your own meal" }).click();
await p.waitForTimeout(700);
assert.equal(await p.getByRole("button", { name: "Enter a name" }).count(), 0);
assert.ok(await p.getByText("Give it a name.").count() >= 1 || await p.getByRole("button", { name: "Give it a name." }).count() >= 1, "can't save an empty meal");

await p.getByLabel("Meal name").fill("Mom's lentil soup");
await p.getByRole("button", { name: "Add an ingredient" }).click();
await p.getByLabel("Search foods").fill("lentil");
await p.waitForTimeout(300);
await p.locator(".own-find .krow").first().click();
await p.getByRole("button", { name: "Add an ingredient" }).click();
await p.getByLabel("Search foods").fill("carrot");
await p.waitForTimeout(300);
if (await p.locator(".own-find .krow").count()) await p.locator(".own-find .krow").first().click();
await p.waitForTimeout(400);
assert.ok((await p.locator(".own-row").count()) >= 1);
assert.ok(await p.locator(".sheet .nums").isVisible(), "numbers appear once there's an ingredient");
await p.screenshot({ path: path.join(out, "om1-form.png") });
await p.getByRole("button", { name: "Save meal" }).click();
await p.waitForTimeout(900);

const saved = (await rows("meals")).find((m) => m.id.startsWith("my-"));
assert.ok(saved, "stored in the database");
assert.equal(saved.name, "Mom's lentil soup");
assert.ok(saved.items.length >= 1);
const pref = (await rows("prefs"))[0].meals[saved.id];
assert.equal(pref.state, "kept");
assert.ok(await p.getByText("Your own meals").isVisible());
assert.ok(await p.locator(".krow", { hasText: "Mom's lentil soup" }).count() >= 1);

await p.reload();
await p.waitForTimeout(1000);
await menuTo(p, "Kitchen");
await p.locator(".seg button", { hasText: "Unlock" }).click();
await p.waitForTimeout(500);
assert.ok(await p.locator(".krow", { hasText: "Mom's lentil soup" }).count() >= 1, "survives a reload");
assert.equal(await p.locator(".newmeals").count(), 0, "not announced as a new meal");

// Hide it again.
await p.locator(".krow", { hasText: "Mom's lentil soup" }).getByRole("button", { name: "Hide" }).click();
await p.waitForTimeout(500);
assert.equal((await rows("prefs"))[0].meals[saved.id].state, "hidden");
console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
