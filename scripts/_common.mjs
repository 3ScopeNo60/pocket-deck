// Shared bits for the end-to-end scripts that start a fresh phone and get to Today.
import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

export async function launch({ url, now } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
  if (now) await ctx.clock.setFixedTime(new Date(now));
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));
  const rows = (s) => p.evaluate((st) => new Promise((res) => { const o = indexedDB.open("pocket-deck"); o.onsuccess = () => { const r = o.result.transaction(st).objectStore(st).getAll(); r.onsuccess = () => res(r.result); }; }), s);
  await p.goto(url ?? pathToFileURL(path.resolve("dist-single/index.html")).href);
  await p.waitForTimeout(900);
  return { browser, ctx, p, errors, rows };
}

export async function toToday(p, supper = "Fish") {
  await p.getByRole("button", { name: "Skip for now" }).click();
  await p.waitForTimeout(400);
  await p.locator(".supper-opt", { hasText: supper }).click();
  await p.getByRole("button", { name: "Plan my day" }).click();
  await p.waitForTimeout(900);
}

export async function menuTo(p, name) {
  await p.getByRole("button", { name: "Menu" }).click();
  await p.waitForTimeout(450);
  await p.getByRole("button", { name, exact: true }).click();
  await p.waitForTimeout(600);
}

export async function scenario(p, title) {
  await menuTo(p, "Me");
  await p.locator(".me-tile", { hasText: "Try a scenario" }).click();
  await p.waitForTimeout(300);
  await p.locator(".krow", { hasText: title }).click();
  await p.waitForTimeout(900);
}
