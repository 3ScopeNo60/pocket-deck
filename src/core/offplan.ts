// Food that wasn't on the plan: a meal swapped for something else, or an extra on top.
// Estimates are deliberately rough and err a little high. They only need to be good enough
// to rebalance the rest of the day and to colour the day's dot fairly.
import type { Day, ExtraEntry, ReplacedEntry } from "./types";

export type OffSize = "small" | "normal" | "big" | "skipped";

export interface OffOption {
  label: string;
  emoji: string;
  group: "Work or shop" | "Takeaway" | "Treats and snacks" | "Drinks";
  /** Saturated fat (g) and sodium (mg) for a normal portion. */
  sat: number;
  na: number;
}

/** What a slot can be replaced with. */
export const REPLACE_OPTIONS: OffOption[] = [
  { label: "Canteen or work lunch", emoji: "🍽️", group: "Work or shop", sat: 6, na: 900 },
  { label: "Sandwich or wrap from a shop", emoji: "🥪", group: "Work or shop", sat: 4, na: 800 },
  { label: "Salad bar", emoji: "🥗", group: "Work or shop", sat: 3, na: 500 },
  { label: "Pie from a bakery", emoji: "🥧", group: "Work or shop", sat: 9, na: 800 },
  { label: "Pastry or muffin", emoji: "🥐", group: "Work or shop", sat: 6, na: 350 },
  { label: "Burger and chips", emoji: "🍔", group: "Takeaway", sat: 10, na: 1100 },
  { label: "Fried chicken", emoji: "🍗", group: "Takeaway", sat: 8, na: 1000 },
  { label: "Pizza", emoji: "🍕", group: "Takeaway", sat: 9, na: 1200 },
  { label: "Sushi", emoji: "🍣", group: "Takeaway", sat: 2, na: 900 },
  { label: "Hot chips", emoji: "🍟", group: "Takeaway", sat: 3, na: 500 },
];
const FALLBACK_REPLACE = { sat: 5, na: 600 };

/** Unplanned extras on top of the plan. */
export const EXTRA_OPTIONS: OffOption[] = [
  { label: "Cake or sweet things", emoji: "🍰", group: "Treats and snacks", sat: 4, na: 150 },
  { label: "Biscuits", emoji: "🍪", group: "Treats and snacks", sat: 3, na: 150 },
  { label: "Chocolate", emoji: "🍫", group: "Treats and snacks", sat: 5, na: 50 },
  { label: "Ice cream", emoji: "🍨", group: "Treats and snacks", sat: 5, na: 60 },
  { label: "Chips or crisps", emoji: "🥔", group: "Treats and snacks", sat: 2, na: 250 },
  { label: "Biltong or cheese", emoji: "🧀", group: "Treats and snacks", sat: 4, na: 600 },
  { label: "Cooldrink or juice", emoji: "🥤", group: "Drinks", sat: 0, na: 10 },
  { label: "Alcohol", emoji: "🍺", group: "Drinks", sat: 0, na: 10 },
];
const FALLBACK_EXTRA = { sat: 3, na: 250 };

export const SIZE_FACTOR: Record<OffSize, number> = { small: 0.6, normal: 1, big: 1.5, skipped: 0 };
export const SIZE_LABEL: Record<Exclude<OffSize, "skipped">, string> = { small: "Small", normal: "Normal", big: "Big" };

const factor = (size: string) => SIZE_FACTOR[size as OffSize] ?? 1;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function replacedNutrition(r: Pick<ReplacedEntry, "what" | "size">): { sat: number; na: number } {
  const base = REPLACE_OPTIONS.find((o) => o.label === r.what) ?? FALLBACK_REPLACE;
  const f = factor(r.size);
  return { sat: round1(base.sat * f), na: Math.round(base.na * f) };
}

export function extraNutrition(x: Pick<ExtraEntry, "kind" | "size">): { sat: number; na: number } {
  const base = EXTRA_OPTIONS.find((o) => o.label === x.kind) ?? FALLBACK_EXTRA;
  const f = x.size === "big" ? 1.6 : x.size === "small" ? 0.5 : 1;
  return { sat: round1(base.sat * f), na: Math.round(base.na * f) };
}

/** Slots that are finished for the day: eaten as planned, or replaced with something else. */
export function doneSlots(d: Pick<Day, "eaten" | "replaced">): string[] {
  return [...d.eaten.map((e) => e.slot), ...(d.replaced ?? []).map((r) => r.slot)];
}

/**
 * Saturated fat that's now spoken for beyond what the plan already counts. A replaced slot keeps
 * its planned meal in the plan, so only what it went over by counts; skipping doesn't free budget.
 */
export function offPlanSat(d: Pick<Day, "replaced" | "extras">, plannedSat: (slot: string) => number): number {
  let over = 0;
  for (const r of d.replaced ?? []) over += Math.max(0, replacedNutrition(r).sat - plannedSat(r.slot));
  for (const x of d.extras ?? []) over += extraNutrition(x).sat;
  return round1(over);
}
