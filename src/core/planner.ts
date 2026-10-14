import type { Food, Meal, Prefs, Product, ShortfallItem, StockItem } from "./types";
import { mealGrams, mealNutrition } from "./nutrition";

export type { ShortfallItem } from "./types";

export type Slot = "breakfast" | "lunch" | "snack";
export type Tonight = "light" | "normal" | "heavy";

export const SLOTS: readonly Slot[] = ["breakfast", "lunch", "snack"];
/** Saturated fat (g) held back for tonight's supper. */
export const TONIGHT_BUFFER: Record<Tonight, number> = { light: 4, normal: 7, heavy: 11 };
export const PLATE = { Small: 0.7, Normal: 1, Big: 1.35 } as const;

/** Saturated fat (g) of a logged supper: its normal-plate figure scaled by plate size. */
export const supperSat = (normalPlateSat: number, plate: keyof typeof PLATE): number => normalPlateSat * PLATE[plate];

export interface DayBudget {
  budget: number;
  carry: number;
}

/**
 * Today's daytime saturated-fat budget. Tonight's supper is held back first. If last night
 * went over a normal supper, half the overshoot comes off today (up to 4 g) and the rest is
 * left to the week: LDL follows the average over days, so one big meal is spread, not punished.
 */
export function dayBudget({ satCap, lastNightSat, tonight }: { satCap: number; lastNightSat: number | null; tonight: Tonight }): DayBudget {
  const over = lastNightSat === null ? 0 : lastNightSat - TONIGHT_BUFFER.normal;
  const carry = Math.min(4, Math.max(0, over * 0.5));
  return { budget: Math.max(2.5, satCap - TONIGHT_BUFFER[tonight] - carry), carry };
}

/** Grams of each food needed by meals already planned for the coming days. */
export function reserved(plannedMealIds: string[], meals: Map<string, Meal>, foods: Map<string, Food>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of plannedMealIds) {
    const meal = meals.get(id);
    if (!meal || meal.bought) continue;
    for (const [foodId, g] of Object.entries(mealGrams(meal, foods))) out[foodId] = (out[foodId] ?? 0) + g;
  }
  return out;
}

function available(stock: StockItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stock) if (s.kind === "food") out[s.itemId] = (out[s.itemId] ?? 0) + s.grams;
  return out;
}

/** What `meal` is short of, given stock minus grams already reserved. Bought meals are always ready. */
export function shortfall(meal: Meal, stock: StockItem[], reservedGrams: Record<string, number>, foods: Map<string, Food>): ShortfallItem[] {
  if (meal.bought) return [];
  const have = available(stock);
  const out: ShortfallItem[] = [];
  for (const [foodId, needG] of Object.entries(mealGrams(meal, foods))) {
    const haveG = Math.max(0, (have[foodId] ?? 0) - (reservedGrams[foodId] ?? 0));
    if (haveG < needG) out.push({ foodId, needG, haveG });
  }
  return out;
}

export function isReady(meal: Meal, stock: StockItem[], reservedGrams: Record<string, number>, foods: Map<string, Food>): boolean {
  return shortfall(meal, stock, reservedGrams, foods).length === 0;
}

export interface DealOptions {
  meals: Meal[];
  foods: Map<string, Food>;
  /** Branded products, keyed by the food they stand in for. */
  products?: Map<string, Product>;
  budget: number;
  stock: StockItem[];
  /** Grams already spoken for by meals planned on other days. Never modified. */
  reservedGrams?: Record<string, number>;
  prefs: Prefs;
  /** The meals currently in each slot (used for locked slots and for swiping). */
  current?: Partial<Record<Slot, string | null>>;
  /** Slots that keep their current meal (already eaten). */
  locked?: Slot[];
  recentCuisines?: string[];
  /** Meals eaten or planned in the last few days; each repeat scores lower so a week has variety. */
  recentMealIds?: string[];
  today: string;
}

export interface DealResult {
  pick: Record<Slot, string | null>;
  /** For a slot with no ready meal that fits: the closest meal and how many grams are missing. */
  nearMiss: Partial<Record<Slot, { mealId: string; missing: number }>>;
}

function mealCost(meal: Meal, foods: Map<string, Food>, products: Map<string, Product>): number {
  if (meal.bought) return meal.bought.price;
  let cost = 0;
  for (const [foodId, g] of Object.entries(mealGrams(meal, foods))) {
    const p = products.get(foodId);
    if (p && p.lastPrice > 0 && p.packG > 0) cost += (g / p.packG) * p.lastPrice;
  }
  return cost;
}

function anchorsOf(meal: Meal, foods: Map<string, Food>): Set<string> {
  const out = new Set<string>();
  for (const item of meal.items) for (const a of foods.get(item.foodId)?.anchors ?? []) out.add(a);
  return out;
}

/** Meals the user hasn't hidden, with no food he said No to. Meals with no preference yet are allowed. */
export function eligible(meal: Meal, prefs: Prefs): boolean {
  const pref = prefs.meals[meal.id];
  if (pref && pref.state !== "kept") return false;
  return !meal.items.some((i) => prefs.foods[i.foodId] === "no");
}

interface Ctx {
  foods: Map<string, Food>;
  products: Map<string, Product>;
  have: Record<string, number>;
  prefs: Prefs;
  recentCuisines: string[];
  recentMealIds: string[];
  today: string;
}

function ctxOf(o: DealOptions): Ctx {
  const have = available(o.stock);
  for (const [f, g] of Object.entries(o.reservedGrams ?? {})) have[f] = (have[f] ?? 0) - g;
  return { foods: o.foods, products: o.products ?? new Map(), have, prefs: o.prefs, recentCuisines: o.recentCuisines ?? [], recentMealIds: o.recentMealIds ?? [], today: o.today };
}

/** The meal's own score, before the day-level anchor bonus. */
function baseScore(meal: Meal, c: Ctx): number {
  const n = mealNutrition(meal, c.foods, c.products);
  let s = n.sol * 2 - mealCost(meal, c.foods, c.products) / 25 - n.na / 900 - n.sat * 0.3;
  for (const i of meal.items) if (c.prefs.foods[i.foodId] === "try") s -= 1;
  const until = c.prefs.meals[meal.id]?.notFeelingUntil;
  if (until && until >= c.today) s -= 3;
  if (!c.recentCuisines.includes(meal.cuisine)) s += 0.5;
  // Repeats cost more the closer they are (the last two days weigh most), so a week doesn't lean on one meal.
  const last = c.recentMealIds.length;
  c.recentMealIds.forEach((id, i) => { if (id === meal.id) s -= last - i <= 6 ? 4 : 1.5; });
  return s;
}

/** Grams a set of meals needs, summed. Bought meals need none. */
function needs(meals: (Meal | null)[], foods: Map<string, Food>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of meals) {
    if (!m || m.bought) continue;
    for (const [f, g] of Object.entries(mealGrams(m, foods))) out[f] = (out[f] ?? 0) + g;
  }
  return out;
}

function fits(meals: (Meal | null)[], c: Ctx): boolean {
  for (const [f, g] of Object.entries(needs(meals, c.foods))) if ((c.have[f] ?? 0) < g) return false;
  return true;
}

const sat = (meals: (Meal | null)[], c: Ctx) =>
  meals.reduce((t, m) => t + (m ? mealNutrition(m, c.foods, c.products).sat : 0), 0);

/**
 * Best-fitting day. Searches every combination of ready meals (a few hundred at most) so a
 * greedy early pick can't strand a later slot. Ranking: most slots filled, then total score
 * (meal scores plus a bonus for each distinct anchor the day covers).
 */
export function deal(o: DealOptions): DealResult {
  const c = ctxOf(o);
  const locked = new Set(o.locked ?? []);
  const byId = new Map(o.meals.map((m) => [m.id, m]));
  const lockedMeal = (s: Slot) => {
    const id = o.current?.[s];
    return id ? byId.get(id) ?? null : null;
  };

  // Locked meals were eaten, so their ingredients are already out of stock: don't reserve them again.
  const options: Record<Slot, (Meal | null)[]> = { breakfast: [null], lunch: [null], snack: [null] };
  for (const s of SLOTS) {
    if (locked.has(s)) {
      options[s] = [lockedMeal(s)];
      continue;
    }
    options[s] = [null, ...o.meals.filter((m) => m.slot === s && eligible(m, o.prefs))];
  }

  let best: { pick: (Meal | null)[]; filled: number; score: number } | null = null;
  for (const b of options.breakfast) for (const l of options.lunch) for (const sn of options.snack) {
    const pick = [b, l, sn];
    const fresh = pick.filter((m, i) => m && !locked.has(SLOTS[i]));
    if (sat(pick, c) > o.budget && fresh.length) continue;
    if (!fits(fresh, c)) continue;
    const filled = pick.filter(Boolean).length;
    const anchors = new Set<string>();
    for (const m of pick) if (m) for (const a of anchorsOf(m, c.foods)) anchors.add(a);
    const score = fresh.reduce((t, m) => t + baseScore(m!, c), 0) + anchors.size * 1.5;
    if (!best || filled > best.filled || (filled === best.filled && score > best.score)) best = { pick, filled, score };
  }

  const pick: DealResult["pick"] = { breakfast: null, lunch: null, snack: null };
  const chosen = best?.pick ?? SLOTS.map((s) => (locked.has(s) ? lockedMeal(s) : null));
  SLOTS.forEach((s, i) => (pick[s] = chosen[i]?.id ?? null));

  // For empty slots, the closest meal that would fit the budget if only it were in stock.
  const nearMiss: DealResult["nearMiss"] = {};
  const taken = needs(SLOTS.map((s) => (locked.has(s) ? null : chosen[SLOTS.indexOf(s)])), c.foods);
  const ownSat = (s: Slot) => sat(chosen.filter((_, i) => SLOTS[i] !== s), c);
  for (const s of SLOTS) {
    if (pick[s] || locked.has(s)) continue;
    let bestMiss: { mealId: string; missing: number } | null = null;
    for (const m of o.meals) {
      if (m.slot !== s || !eligible(m, o.prefs)) continue;
      if (ownSat(s) + mealNutrition(m, c.foods, c.products).sat > o.budget) continue;
      const after = { ...c, have: { ...c.have } };
      for (const [f, g] of Object.entries(taken)) after.have[f] = (after.have[f] ?? 0) - g;
      let missing = 0;
      for (const [f, g] of Object.entries(needs([m], c.foods))) missing += Math.max(0, g - Math.max(0, after.have[f] ?? 0));
      if (!bestMiss || missing < bestMiss.missing) bestMiss = { mealId: m.id, missing };
    }
    if (bestMiss) nearMiss[s] = bestMiss;
  }

  return { pick, nearMiss };
}

/**
 * The next meal in `slot`, in swipe direction, that is eligible, ready alongside the day's other
 * current meals, and keeps the day within budget. Null if there is none.
 */
export function nextFitting(o: DealOptions, slot: Slot, dir: 1 | -1): string | null {
  const c = ctxOf(o);
  const current = o.current ?? {};
  if ((o.locked ?? []).includes(slot)) return current[slot] ?? null;
  const inSlot = o.meals.filter((m) => m.slot === slot);
  const at = inSlot.findIndex((m) => m.id === current[slot]);
  if (!inSlot.length) return null;
  const others = SLOTS.filter((s) => s !== slot && !(o.locked ?? []).includes(s))
    .map((s) => o.meals.find((m) => m.id === current[s]) ?? null);
  const othersAll = SLOTS.filter((s) => s !== slot).map((s) => o.meals.find((m) => m.id === current[s]) ?? null);
  const n = inSlot.length;
  for (let step = 1; step < n + (at === -1 ? 1 : 0); step++) {
    const i = at === -1 ? step - 1 : (((at + dir * step) % n) + n) % n;
    const m = inSlot[i];
    if (!eligible(m, o.prefs)) continue;
    if (!fits([m, ...others], c)) continue;
    if (sat([m, ...othersAll], c) > o.budget) continue;
    return m.id;
  }
  return null;
}
