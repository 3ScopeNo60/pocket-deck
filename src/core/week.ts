// Planning a week. Pure logic: the Week screen and tests call this.
// A week is planned from every meal the user would eat, not just what's in the pantry; what the
// pantry can't cover becomes the shopping list.
import type { Food, Meal, Prefs, Product, StockItem } from "./types";
import { dayBudget, deal, nextFitting, reserved, SLOTS, type DealOptions, type Slot, type Tonight } from "./planner";
import { mealGrams } from "./nutrition";
import type { Need } from "./stock";

export interface WeekDay {
  tonight: Tonight;
  plan: Record<Slot, string | null>;
  /** Set once the user changes the day by hand; re-planning leaves it alone. */
  pinned?: boolean;
}
export type WeekPlan = Record<string, WeekDay>;

export interface PlanWeekInput {
  /** Dates to plan, in order (YYYY-MM-DD). */
  dates: string[];
  /** Supper tags the user has given; any date without one is Normal. */
  tonight: Record<string, Tonight>;
  /** An earlier plan; days marked `pinned` are kept as they are. */
  existing?: WeekPlan;
  meals: Meal[];
  foods: Map<string, Food>;
  products?: Map<string, Product>;
  prefs: Prefs;
  satCap: number;
  /** What's really in the pantry. */
  stock: StockItem[];
  /** Meals still to be eaten today; their ingredients are spoken for. */
  heldIds?: string[];
  /** What was eaten or planned just before the first date, so day one isn't a repeat. */
  recentMealIds?: string[];
  /** Rough rand cost of one serving of a meal. */
  costOf?: (meal: Meal) => number;
}

export interface WeekResult {
  days: WeekPlan;
  /** What the pantry can't cover, in grams per food. */
  needs: Need[];
  /** Estimated cost of the planned meals, in rand. */
  cost: number;
}

/** Every food in effectively unlimited supply, so planning isn't limited by today's pantry. */
function plenty(foods: Map<string, Food>): StockItem[] {
  return [...foods.keys()].map((itemId) => ({ itemId, kind: "food" as const, grams: 1e9, updatedAt: "" }));
}

const budgetFor = (satCap: number, tonight: Tonight) => dayBudget({ satCap, lastNightSat: null, tonight }).budget;

export function planWeek(o: PlanWeekInput): WeekResult {
  const days: WeekPlan = {};
  const unlimited = plenty(o.foods);
  const byId = new Map(o.meals.map((m) => [m.id, m]));
  const history: string[] = [...(o.recentMealIds ?? [])];
  let cuisines: string[] = [];

  for (const date of o.dates) {
    const tonight = o.tonight[date] ?? o.existing?.[date]?.tonight ?? "normal";
    const kept = o.existing?.[date];
    let plan: Record<Slot, string | null>;
    if (kept?.pinned) {
      plan = { ...kept.plan };
    } else {
      plan = deal({
        meals: o.meals, foods: o.foods, products: o.products, budget: budgetFor(o.satCap, tonight), stock: unlimited,
        prefs: o.prefs, today: date, recentCuisines: cuisines, recentMealIds: history,
      }).pick;
    }
    days[date] = { tonight, plan, ...(kept?.pinned ? { pinned: true } : {}) };
    const picked = SLOTS.map((s) => plan[s]).filter((x): x is string => !!x);
    history.push(...picked);
    cuisines = picked.map((id) => byId.get(id)?.cuisine ?? "").filter(Boolean);
  }

  return { days, ...needsFor(days, o) };
}

/** What a plan needs from the shop and roughly what it costs, given the pantry. */
export function needsFor(days: WeekPlan, o: Pick<PlanWeekInput, "meals" | "foods" | "stock" | "heldIds" | "costOf">): { needs: Need[]; cost: number } {
  const byId = new Map(o.meals.map((m) => [m.id, m]));
  const need: Record<string, number> = {};
  let cost = 0;
  for (const d of Object.values(days)) {
    for (const s of SLOTS) {
      const m = d.plan[s] ? byId.get(d.plan[s]!) : null;
      if (!m) continue;
      cost += o.costOf?.(m) ?? 0;
      if (m.bought) continue;
      for (const [f, g] of Object.entries(mealGrams(m, o.foods, { required: true }))) need[f] = (need[f] ?? 0) + g;
    }
  }
  const spoken = reserved(o.heldIds ?? [], byId, o.foods);
  const have: Record<string, number> = {};
  for (const s of o.stock) if (s.kind === "food") have[s.itemId] = (have[s.itemId] ?? 0) + s.grams;
  const needs: Need[] = Object.entries(need)
    .map(([foodId, g]) => ({ foodId, needG: Math.round(g - Math.max(0, (have[foodId] ?? 0) - (spoken[foodId] ?? 0))) }))
    .filter((n) => n.needG > 0);
  return { needs, cost: Math.round(cost) };
}

/**
 * Swap one slot of one planned day for the next meal in swipe direction that fits that day's
 * budget (pantry is ignored: shopping will cover it). Returns the new week, or null if nothing else fits.
 */
export function swapInWeek(week: WeekPlan, date: string, slot: Slot, dir: 1 | -1, o: Omit<PlanWeekInput, "dates" | "tonight" | "stock">): WeekPlan | null {
  const day = week[date];
  if (!day) return null;
  const opts: DealOptions = {
    meals: o.meals, foods: o.foods, products: o.products, budget: budgetFor(o.satCap, day.tonight), stock: plenty(o.foods),
    prefs: o.prefs, current: day.plan, today: date,
  };
  const id = nextFitting(opts, slot, dir);
  if (!id || id === day.plan[slot]) return null;
  return { ...week, [date]: { ...day, plan: { ...day.plan, [slot]: id }, pinned: true } };
}

/** Change a day's supper tag. Un-pinned days are re-dealt for the new budget by the caller (planWeek). */
export function tagTonight(week: WeekPlan, date: string, tonight: Tonight): WeekPlan {
  const day = week[date];
  return day ? { ...week, [date]: { ...day, tonight } } : week;
}

export interface PrepLine {
  mealId: string;
  name: string;
  emoji: string;
  dates: string[];
  keepsDays: number;
  /** True when the meal is eaten on more days than it keeps: cook it twice. */
  splits: boolean;
}

/** Meals worth making ahead (they have a prep group), with the days they're eaten on. */
export function prepLines(week: WeekPlan, meals: Meal[]): PrepLine[] {
  const byId = new Map(meals.map((m) => [m.id, m]));
  const used = new Map<string, string[]>();
  for (const date of Object.keys(week).sort()) {
    for (const s of SLOTS) {
      const id = week[date].plan[s];
      if (id && byId.get(id)?.prepGroup) used.set(id, [...(used.get(id) ?? []), date]);
    }
  }
  return [...used.entries()]
    .map(([mealId, dates]) => {
      const m = byId.get(mealId)!;
      const span = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000;
      return { mealId, name: m.name, emoji: m.emoji, dates, keepsDays: m.keepsDays, splits: span >= m.keepsDays };
    })
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}
