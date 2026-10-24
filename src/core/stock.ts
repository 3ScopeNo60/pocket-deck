// Pantry and shopping-list logic for the Kitchen screen. Pure functions: the screen and
// tests call these, and nothing here touches storage.
import type { Food, Meal, Prefs, Product, ShoppingItem, StockItem } from "./types";
import { eligible, shortfall } from "./planner";
import { packsFor } from "./shopping";

/* ── amounts in kitchen measures ───────────────────────────── */

const UNIT_ORDER = ["cup", "tin", "slice", "handful", "clove", "tbsp", "tsp"] as const;
const PLURAL: Record<string, string> = { cup: "cups", tin: "tins", slice: "slices", handful: "handfuls", clove: "cloves", tbsp: "tbsp", tsp: "tsp" };

interface Unit {
  /** Grams in one of this unit. */
  g: number;
  /** "cup", "tin"… or "" for a plain count (eggs, apples). */
  word: string;
}

const FRACTION_OF: Record<string, number> = { "½": 0.5, "¼": 0.25, "⅓": 1 / 3, "¾": 0.75 };

/**
 * The kitchen unit a food is best counted in, or null when only grams make sense. Uses an
 * exact "1 cup" / "1 tin" key if there is one, else a plain fraction of it ("½ tin").
 */
export function unitFor(food: Food): Unit | null {
  const keys = Object.keys(food.measures);
  for (const word of UNIT_ORDER) {
    const exact = keys.find((k) => k === `1 ${word}` || k.startsWith(`1 ${word} `));
    if (exact) return { g: food.measures[exact], word };
    for (const [frac, f] of Object.entries(FRACTION_OF)) {
      const k = `${frac} ${word}`; // exactly "½ tin", not "½ cup grated"
      if (food.measures[k] !== undefined) return { g: food.measures[k] / f, word };
    }
  }
  if (food.measures["1"]) return { g: food.measures["1"], word: "" };
  return null;
}

const FRACTIONS: Record<number, string> = { 0.5: "½" };

function niceNumber(n: number): string {
  if (n >= 10) return String(Math.round(n));
  const half = Math.round(n * 2) / 2;
  const whole = Math.floor(half);
  const frac = half - whole ? FRACTIONS[0.5] : "";
  return whole === 0 ? frac || "0" : `${whole}${frac}`;
}

/** "6 cups", "12", "½ tin", or "150 g" when the food has no everyday unit. */
export function formatAmount(food: Food, grams: number): string {
  if (grams <= 0) return "None";
  const u = unitFor(food);
  if (!u) return `${Math.max(10, Math.round(grams / 10) * 10)} g`;
  const n = grams / u.g;
  const text = niceNumber(n);
  if (!u.word) return text;
  return `${text} ${n > 1.25 ? PLURAL[u.word] : u.word}`;
}

/** One tap of a +/- stepper, in grams. */
export function stepGrams(food: Food): number {
  return unitFor(food)?.g ?? 50;
}

/** Running low: a quarter of the smallest pack or less (but not none). */
export function isLow(food: Food, grams: number): boolean {
  return grams > 0 && grams <= 0.25 * Math.min(...food.packSizes);
}

/** Take a meal's ingredients out of the pantry: never below nothing, and never from a food with no record. `removed` is what actually came out. */
export function takeStock(stock: StockItem[], grams: Record<string, number>, at: string): { next: StockItem[]; changed: StockItem[]; removed: Record<string, number> } {
  const byId = new Map(stock.map((s) => [s.itemId, s]));
  const changed: StockItem[] = [];
  const removed: Record<string, number> = {};
  for (const [itemId, g] of Object.entries(grams)) {
    const cur = byId.get(itemId);
    const take = cur ? Math.min(cur.grams, g) : 0;
    if (!cur || take <= 0) continue;
    const row: StockItem = { ...cur, grams: cur.grams - take, updatedAt: at };
    byId.set(itemId, row);
    changed.push(row);
    removed[itemId] = take;
  }
  return { next: [...byId.values()], changed, removed };
}

export function withStock(stock: StockItem[], grams: Record<string, number>, sign: 1 | -1, at: string): { next: StockItem[]; changed: StockItem[] } {
  const byId = new Map(stock.map((s) => [s.itemId, s]));
  const changed: StockItem[] = [];
  for (const [itemId, g] of Object.entries(grams)) {
    const cur = byId.get(itemId);
    if (!cur && sign === -1) continue; // nothing recorded, nothing to take off
    const row: StockItem = { itemId, kind: "food", grams: Math.max(0, (cur?.grams ?? 0) + sign * g), updatedAt: at };
    byId.set(itemId, row);
    changed.push(row);
  }
  return { next: [...byId.values()], changed };
}

/* ── restock ───────────────────────────────────────────────── */

/** Grams that land in the pantry for `packs` packs of `packG`. Dry foods stocked cooked are scaled up. */
export function restockGrams(food: Food, packs: number, packG: number): number {
  return Math.round(packs * packG * (food.cookedYield ?? 1));
}

export function addToStock(stock: StockItem[], foodId: string, grams: number, at: string): { next: StockItem[]; row: StockItem } {
  const cur = stock.find((s) => s.itemId === foodId && s.kind === "food");
  const row: StockItem = { itemId: foodId, kind: "food", grams: Math.max(0, (cur?.grams ?? 0) + grams), updatedAt: at };
  return { next: [...stock.filter((s) => s !== cur), row], row };
}

/* ── shopping list ─────────────────────────────────────────── */

export interface Need {
  foodId: string;
  /** Grams still needed. */
  needG: number;
}

const rowId = (foodId: string) => `s-${foodId}`;

/**
 * Add what's missing to the list, one row per food. Adding the same thing again merges
 * (keeps the larger need) instead of doubling, so "Add to list" is safe to tap twice.
 */
export function addNeeds(list: ShoppingItem[], needs: Need[], foods: Map<string, Food>, reason: ShoppingItem["reason"]): ShoppingItem[] {
  const byId = new Map(list.map((r) => [r.id, r]));
  for (const n of needs) {
    const food = foods.get(n.foodId);
    if (!food || n.needG <= 0) continue;
    const cur = byId.get(rowId(n.foodId));
    const needG = Math.max(cur?.needG ?? 0, n.needG);
    // Needs are in the pantry's grams (cooked for barley, lentils, rice and pasta); packs are weighed dry.
    const { packG, count } = packsFor(needG / (food.cookedYield || 1), food.packSizes);
    byId.set(rowId(n.foodId), {
      id: rowId(n.foodId), itemId: n.foodId, kind: "food", packs: Math.max(1, count), shopUnitG: packG,
      reason: cur?.reason ?? reason, checked: cur?.checked ?? false, needG,
    });
  }
  return [...byId.values()];
}

/** Likely total at the last prices seen. `unpriced` counts rows with no price yet. */
export function listTotal(list: ShoppingItem[], products: Map<string, Product>): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const r of list) {
    const p = products.get(r.itemId);
    if (p && p.lastPrice > 0 && p.packG > 0) total += (r.packs * r.shopUnitG * p.lastPrice) / p.packG;
    else unpriced += 1;
  }
  return { total: Math.round(total), unpriced };
}

/* ── meals to unlock ───────────────────────────────────────── */

export interface UnlockEntry {
  meal: Meal;
  missing: { foodId: string; needG: number; haveG: number }[];
}

/** Meals you'd eat but can't make yet, closest first (fewest missing foods, then least missing grams). */
export function unlockList(meals: Meal[], foods: Map<string, Food>, stock: StockItem[], prefs: Prefs): UnlockEntry[] {
  const out: UnlockEntry[] = [];
  for (const meal of meals) {
    if (meal.bought || !eligible(meal, prefs)) continue;
    const missing = shortfall(meal, stock, {}, foods);
    if (missing.length) out.push({ meal, missing });
  }
  const gaps = (e: UnlockEntry) => e.missing.reduce((t, m) => t + (m.needG - m.haveG), 0);
  return out.sort((a, b) => a.missing.length - b.missing.length || gaps(a) - gaps(b));
}
