// Turning the stored days into scored dots. The supper for a day is recorded the next
// morning (as that day's "last night"), so each day looks one day ahead for it.
import { foodIndex, mealIndex, suppers } from "../core/content";
import { PLATE } from "../core/planner";
import { scoreDay, type DayScore, type Supper } from "../core/score";
import type { Day, Med } from "../core/types";

const mealMap = mealIndex;
const foodMap = foodIndex;
const supperMap = new Map(suppers.map((s) => [s.id, s]));

export const iso = (d: Date) => d.toLocaleDateString("en-CA");
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** The n dates ending at `end`, oldest first. */
export const lastDates = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));

export function supperOf(next: Day | undefined): Supper | null {
  const ln = next?.lastNight;
  const s = ln && supperMap.get(ln.supperId);
  if (!ln || !s) return null;
  const k = PLATE[ln.plate];
  return { id: s.id, name: s.name, takeaway: s.group === "Takeaway", sat: s.sat * k, na: s.na * k };
}

export function scoreDate(date: string, byDate: Map<string, Day>, satCap: number, med: Pick<Med, "times"> | null): DayScore {
  const day = byDate.get(date);
  const empty: Day = { date, lastNight: null, tonight: "normal", plan: { breakfast: null, lunch: null, snack: null }, eaten: [], extras: [], replaced: [], walk: false };
  return scoreDay({ day: day ?? empty, meals: mealMap, foods: foodMap, satCap, supper: supperOf(byDate.get(addDays(date, 1))), med });
}
export { mealMap, foodMap };
