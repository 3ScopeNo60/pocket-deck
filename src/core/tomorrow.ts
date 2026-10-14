// What tomorrow needs from tonight: meals to make the night before, and what to buy.
// Tomorrow's meals come from the week plan if there is one for that date, otherwise from
// dealing the day as the planner would. Pure: the screen and the tests call this.
import type { Food, Meal, Prefs, Product, StockItem } from "./types";
import { SLOTS, type Slot } from "./planner";
import { needsFor, planWeek, type WeekPlan } from "./week";
import type { Need } from "./stock";

export interface PrepTask {
  mealId: string;
  text: string;
  detail: string;
}

export interface TomorrowPlan {
  date: string;
  source: "week" | "dealt";
  plan: Record<Slot, string | null>;
  prep: PrepTask[];
  needs: Need[];
}

export interface TomorrowInput {
  /** Tomorrow's date, YYYY-MM-DD. */
  date: string;
  week: WeekPlan | null;
  meals: Meal[];
  foods: Map<string, Food>;
  products?: Map<string, Product>;
  prefs: Prefs;
  satCap: number;
  stock: StockItem[];
  /** Today's meals, so tomorrow isn't a repeat. */
  recentMealIds?: string[];
}

export const NIGHT_BEFORE_TAG = "Make the night before";

const NAME_LIMIT = 3;

export function prepFor(plan: Record<Slot, string | null>, meals: Map<string, Meal>, foods: Map<string, Food>): PrepTask[] {
  const out: PrepTask[] = [];
  const seen = new Set<string>();
  for (const s of SLOTS) {
    const m = plan[s] ? meals.get(plan[s]!) : null;
    if (!m || seen.has(m.id) || !(m.tags.includes(NIGHT_BEFORE_TAG) || m.prepGroup === "night-before")) continue;
    seen.add(m.id);
    const names = m.items.map((i) => foods.get(i.foodId)?.name).filter((n): n is string => !!n);
    const shown = names.slice(0, NAME_LIMIT).join(", ");
    out.push({ mealId: m.id, text: `Make the ${m.name.toLowerCase()}`, detail: `${shown}${names.length > NAME_LIMIT ? " and more" : ""}. Fridge till morning.` });
  }
  return out;
}

export function tomorrowPlan(i: TomorrowInput): TomorrowPlan {
  const mealMap = new Map(i.meals.map((m) => [m.id, m]));
  const fromWeek = i.week?.[i.date];
  const hasWeek = !!fromWeek && SLOTS.some((s) => fromWeek.plan[s]);
  if (hasWeek) {
    const days: WeekPlan = { [i.date]: fromWeek! };
    return {
      date: i.date, source: "week", plan: fromWeek!.plan,
      prep: prepFor(fromWeek!.plan, mealMap, i.foods),
      needs: needsFor(days, { meals: i.meals, foods: i.foods, stock: i.stock }).needs,
    };
  }
  const r = planWeek({
    dates: [i.date], tonight: {}, meals: i.meals, foods: i.foods, products: i.products, prefs: i.prefs,
    satCap: i.satCap, stock: i.stock, recentMealIds: i.recentMealIds,
  });
  const day = r.days[i.date];
  return {
    date: i.date, source: "dealt", plan: day.plan,
    prep: prepFor(day.plan, mealMap, i.foods),
    needs: r.needs,
  };
}
