// A meal Levi builds himself: pick ingredients and measures, and the app works out the numbers.
import type { Food, Meal, MealItem } from "./types";

export interface MealDraft {
  name: string;
  emoji: string;
  slot: Meal["slot"];
  items: MealItem[];
  /** One step per line; optional. */
  steps: string;
}

export const OWN_PREFIX = "my-";
export const OWN_TAG = "Your own";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "meal";

/** Why the draft can't be saved yet, or null when it can. */
export function draftProblem(d: MealDraft, foods: Map<string, Food>): string | null {
  if (!d.name.trim()) return "Give it a name.";
  if (d.items.length === 0) return "Add at least one ingredient.";
  for (const i of d.items) {
    const f = foods.get(i.foodId);
    if (!f || f.measures[i.measure] === undefined) return "One ingredient is missing an amount.";
  }
  return null;
}

export function buildCustomMeal(d: MealDraft, taken: Set<string>, foods: Map<string, Food>): Meal {
  const base = OWN_PREFIX + slug(d.name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  const keeps = d.items.map((i) => foods.get(i.foodId)?.keepsDays).filter((n): n is number => typeof n === "number");
  const steps = d.steps.split("\n").map((s) => s.trim()).filter(Boolean);
  return {
    id,
    slot: d.slot,
    name: d.name.trim(),
    emoji: d.emoji || "🍽️",
    items: d.items.map((i) => ({ foodId: i.foodId, measure: i.measure })),
    steps: steps.length ? steps : ["Put it together and enjoy."],
    boosters: [],
    tags: [OWN_TAG],
    cuisine: "Home",
    keepsDays: Math.max(1, keeps.length ? Math.min(...keeps) : 2),
  };
}
