// Menu feel: hold and slide across the fan and the options respond. Usage: node scripts/menufeel.mjs <out-dir>
import assert from "node:assert/strict";
import path from "node:path";
import { launch, menuTo, toToday } from "./_common.mjs";

const out = process.argv[2] ?? ".";
const { browser, p, errors, rows } = await launch();
await toToday(p);
await menuTo(p, "Me");

const widths = () => p.locator(".fan-disc").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width * 10) / 10));

async function slideTo(i, shot) {
  const core = await p.locator(".fan-core").boundingBox();
  const cx = core.x + core.width / 2, cy = core.y + core.height / 2;
  // the fan is a quarter circle from the core: first option along the bottom to the left, last straight up
  const n = await p.locator(".fan-opt").count();
  const deg = -180 + (90 / (n - 1)) * i;
  const a = (deg * Math.PI) / 180;
  const R = 68;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  await p.waitForTimeout(400);
  for (let k = 1; k <= 8; k++) await p.mouse.move(cx + Math.cos(a) * R * (k / 8), cy + Math.sin(a) * R * (k / 8));
  await p.waitForTimeout(700);
  const w = await widths();
  if (shot) await p.screenshot({ path: path.join(out, shot) });
  // let go back at the centre so nothing is chosen
  await p.mouse.move(cx, cy);
  await p.waitForTimeout(150);
  await p.mouse.up();
  await p.waitForTimeout(300);
  // a tap on the open fan puts it away
  await p.mouse.click(cx, cy);
  await p.waitForTimeout(500);
  return w;
}

async function setMode(label) {
  await p.getByLabel("Menu feel").getByRole("button", { name: label, exact: true }).click();
  await p.waitForTimeout(300);
}

for (const mode of ["Off", "Lens", "Magnet", "Lean"]) {
  await setMode(mode);
  const w = await slideTo(1, `mf-${mode.toLowerCase()}.png`);
  console.log(mode, w);
  const aimed = w[1];
  const others = w.filter((_, j) => j !== 1);
  if (mode === "Off") assert.ok(Math.max(...w) - Math.min(...w) < 1, "no change when off");
  if (mode === "Lens" || mode === "Lean") assert.ok(aimed > 52 && others.every((o) => o <= aimed), "the one you're over swells");
  if (mode === "Magnet") assert.ok(aimed > 52 && others.every((o) => o < 48), "aimed swells, the rest give way");
}

// it settles back when you let go
const rest = await widths();
assert.ok(Math.max(...rest) - Math.min(...rest) < 1.5, "all back to the same size at rest");

// the choice is remembered
await setMode("Magnet");
assert.equal((await rows("prefs"))[0].menuFeel.mode, "magnet");
await p.reload();
await p.waitForTimeout(900);
await menuTo(p, "Me");
assert.equal(await p.getByLabel("Menu feel").getByRole("button", { name: "Magnet", exact: true }).getAttribute("aria-pressed"), "true");

console.log("errors:", errors.length ? errors : "none");
assert.equal(errors.length, 0);
await browser.close();
