// What is running out, and how soon each thing on the shopping list is needed. The pantry is run
// forward through the meals still planned (the rest of today, then the week plan): the first
// day a food is short is the day it's needed by.
import { mealGrams } from "./nutrition";
import { isLow } from "./stock";
import type { Food, FoodPortion, Meal, ShoppingItem, StockItem } from "./types";

export interface PlannedDay { date: string; mealIds: string[]; /** Daily habits that day (psyllium), taken from the pantry like a meal. */ portions?: FoodPortion[] }

export interface Projection {
  /** First day each food is short for a planned meal, and by how much in all. */
  short: Map<string, { date: string; needG: number }>;
  /** Grams left once every planned meal is made, for foods those meals use. */
  endG: Map<string, number>;
  /** Foods the plan uses at all. */
  used: Set<string>;
}

export function projectStock(stock: StockItem[], plans: PlannedDay[], meals: Map<string, Meal>, foods: Map<string, Food>): Projection {
  const running = new Map<string, number>();
  for (const s of stock) if (s.kind === "food") running.set(s.itemId, (running.get(s.itemId) ?? 0) + s.grams);
  const short = new Map<string, { date: string; needG: number }>();
  const used = new Set<string>();
  for (const day of [...plans].sort((a, b) => a.date.localeCompare(b.date))) {
    const uses: Record<string, number>[] = [];
    for (const id of day.mealIds) {
      const m = meals.get(id);
      if (m && !m.bought) uses.push(mealGrams(m, foods));
    }
    for (const p of day.portions ?? []) {
      const g = foods.get(p.foodId)?.measures[p.measure];
      if (g !== undefined) uses.push({ [p.foodId]: g * p.qty });
    }
    for (const use of uses) {
      for (const [foodId, g] of Object.entries(use)) {
        used.add(foodId);
        const left = (running.get(foodId) ?? 0) - g;
        running.set(foodId, left);
        if (left < 0) {
          const cur = short.get(foodId);
          short.set(foodId, { date: cur?.date ?? day.date, needG: -left });
        }
      }
    }
  }
  const endG = new Map<string, number>();
  for (const f of used) endG.set(f, Math.max(0, running.get(f) ?? 0));
  return { short, endG, used };
}

export type RunOutKind = "short" | "low" | "ending";
export interface RunOut {
  foodId: string;
  kind: RunOutKind;
  /** The day it runs out, for "short". */
  date?: string;
  haveG: number;
}

/**
 * Foods that will run out before the end of the planned days, are low now, or will be nearly gone
 * by then. Soonest first.
 */
export function runningOut(stock: StockItem[], p: Projection, foods: Map<string, Food>): RunOut[] {
  const have = new Map<string, number>();
  for (const s of stock) if (s.kind === "food") have.set(s.itemId, (have.get(s.itemId) ?? 0) + s.grams);
  const out: RunOut[] = [];
  const seen = new Set<string>();
  for (const [foodId, sh] of p.short) {
    if (!foods.get(foodId)) continue;
    out.push({ foodId, kind: "short", date: sh.date, haveG: have.get(foodId) ?? 0 });
    seen.add(foodId);
  }
  for (const [foodId, g] of have) {
    const f = foods.get(foodId);
    if (!f || seen.has(foodId) || g <= 0) continue;
    if (isLow(f, g)) { out.push({ foodId, kind: "low", haveG: g }); seen.add(foodId); }
  }
  for (const [foodId, end] of p.endG) {
    const f = foods.get(foodId);
    if (!f || seen.has(foodId)) continue;
    if ((have.get(foodId) ?? 0) > 0 && end <= 0.25 * Math.min(...f.packSizes)) { out.push({ foodId, kind: "ending", haveG: have.get(foodId) ?? 0 }); seen.add(foodId); }
  }
  const rank = (r: RunOut) => (r.kind === "short" ? r.date! : r.kind === "low" ? "9990" : "9991");
  return out.sort((a, b) => rank(a).localeCompare(rank(b)) || a.foodId.localeCompare(b.foodId));
}

export interface Urgency {
  /** 0 is today, 1 tomorrow, and so on; bigger is less urgent. */
  rank: number;
  label: string;
  /** Today or tomorrow. */
  urgent: boolean;
}

const WEEKDAY = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 86_400_000);

/** How soon a row of the shopping list is needed: by the plan if a planned meal runs short, else by its reason. */
export function urgencyOf(row: Pick<ShoppingItem, "itemId" | "reason">, p: Projection, today: string): Urgency {
  const sh = p.short.get(row.itemId);
  if (sh) {
    const n = Math.max(0, daysBetween(today, sh.date));
    return { rank: n, label: n === 0 ? "Needed today" : n === 1 ? "Needed tomorrow" : `Needed by ${WEEKDAY(sh.date)}`, urgent: n <= 1 };
  }
  if (row.reason === "low") return { rank: 3, label: "Running low", urgent: false };
  if (row.reason === "plan") return { rank: 4, label: "For the week", urgent: false };
  if (row.reason === "unlock") return { rank: 20, label: "No rush", urgent: false };
  return { rank: 10, label: "No rush", urgent: false };
}

export type ListGroup = "week" | "mine" | "unlock";
export const GROUP_TITLE: Record<ListGroup, string> = { week: "For your week", mine: "Added by you", unlock: "To unlock a meal" };

/** Which group a row belongs in: low and plan are for the week. */
export const groupOf = (r: Pick<ShoppingItem, "reason">): ListGroup => (r.reason === "unlock" ? "unlock" : r.reason === "manual" ? "mine" : "week");
