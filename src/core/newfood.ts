// A food that isn't in the shipped list, added from its nutrition label. It becomes a real food:
// it can be stocked, put on the list, and used in a meal he builds.
import type { Food } from "./types";

export const FOOD_PREFIX = "mine-";

export interface NewFoodDraft {
  name: string;
  emoji: string;
  aisle: string;
  /** Grams (or ml) in one pack. */
  packG: number;
  per100: { kcal: number; sat: number; na: number; fibre?: number; sol?: number };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "food";

/** Why the draft can't be saved yet, or null when it can. */
export function newFoodProblem(d: NewFoodDraft): string | null {
  if (!d.name.trim()) return "Give it a name.";
  if (!(d.packG > 0)) return "How big is one pack?";
  return null;
}

export function buildFood(d: NewFoodDraft, taken: Set<string>): Food {
  const base = FOOD_PREFIX + slug(d.name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  const pack = Math.round(d.packG);
  return {
    id,
    name: d.name.trim(),
    emoji: d.emoji || "🛒",
    per100: { kcal: d.per100.kcal, sat: d.per100.sat, mono: 0, poly: 0, na: d.per100.na, fibre: d.per100.fibre ?? 0, sol: d.per100.sol ?? 0, betaGlucan: 0 },
    // Portions in a meal: by weight, or the whole pack.
    measures: { "50 g": 50, "100 g": 100, "1 pack": pack },
    keepsDays: null,
    anchors: [],
    cuisines: [],
    packSizes: [pack],
    mine: true,
    aisle: d.aisle,
    source: "Read from the pack's nutrition label.",
  };
}
