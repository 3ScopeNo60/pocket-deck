import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as db from "./db";
import { closeDb } from "./db";
import { backupFilename, exportAll, importAll } from "./backup";
import type { Day, Lab, Profile, StockItem } from "./types";

const profile: Profile = { heightCm: 180, weightKg: 85, age: 35, sex: "male", activity: "moderate", hand: "right", budgetPerWeek: 500, units: "kitchen" };
const day: Day = { date: "2026-10-14", lastNight: { supperId: "braai", plate: "Big" }, tonight: "normal", plan: { breakfast: "oats", lunch: null, snack: null }, eaten: [], extras: [], replaced: [], walk: true };
const stock: StockItem = { itemId: "oats", kind: "food", grams: 400, updatedAt: "2026-10-14T08:00:00Z" };
const lab: Lab = { date: "2026-02-10", total: 6.2, ldl: 4.1, hdl: 1.2, trig: 1.5 };

async function wipe() {
  await closeDb();
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase("pocket-deck");
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

describe("backup", () => {
  beforeEach(wipe);

  it("round-trips every store through export and import", async () => {
    await db.put("profile", profile);
    await db.put("days", day);
    await db.put("stock", stock);
    await db.put("labs", lab);
    const file = await exportAll();
    expect(file.stores.days[0].date).toBe("2026-10-14");
    expect(JSON.parse(JSON.stringify(file)).app).toBe("pocket-deck");

    await db.clear("days");
    await db.clear("profile");
    await importAll(JSON.parse(JSON.stringify(file)));
    expect(await db.get("days", "2026-10-14")).toEqual(day);
    expect(await db.get("profile", "me")).toEqual(profile);
    expect(await db.get("stock", "oats")).toEqual(stock);
    expect(await db.get("labs", "2026-02-10")).toEqual(lab);
  });

  it("keeps the existing data when the file is malformed", async () => {
    await db.put("stock", stock);
    await expect(importAll({ app: "pocket-deck", version: 2, stores: {} })).rejects.toThrow(/backup/i);
    await expect(importAll(null)).rejects.toThrow();
    expect(await db.get("stock", "oats")).toEqual(stock);
  });

  it("keeps the existing data when one row can't be stored", async () => {
    await db.put("stock", stock);
    const file = await exportAll();
    const bad = JSON.parse(JSON.stringify(file));
    bad.stores.days = [{ no: "date here" }];
    await expect(importAll(bad)).rejects.toThrow();
    expect(await db.get("stock", "oats")).toEqual(stock);
  });

  it("names the file by date", () => {
    expect(backupFilename(new Date(2026, 9, 4))).toBe("pocket-deck-backup-2026-10-04.json");
  });
});
