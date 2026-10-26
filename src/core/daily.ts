// A daily habit that is a food (psyllium husk): which portion falls on which day, and whether it was taken.
import type { Day, DailyItem, ExtraEntry, FoodPortion } from "./types";

const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 86_400_000);

/** "1 tsp", "1 tbsp" (three teaspoons), or "2 tsp". */
export function portionWords(measure: string, qty: number): string {
  if (measure === "1 tsp" && qty === 3) return "1 tbsp";
  if (measure === "1 tsp" && qty % 3 === 0) return `${qty / 3} tbsp`;
  if (measure === "1 tsp") return `${qty} tsp`;
  return qty === 1 ? measure : `${qty} × ${measure}`;
}

export interface DailyPortion {
  portion: FoodPortion;
  words: string;
  /** Which day of the schedule this is, from 1. */
  dayNo: number;
  /** Which phase (0-based), and how many days it has left including today (null for the last, endless one). */
  phase: number;
  daysLeft: number | null;
}

/** What to take on `date`, or null before the start. */
export function portionOn(item: DailyItem, date: string): DailyPortion | null {
  const n = days(item.startDate, date);
  if (n < 0 || item.phases.length === 0) return null;
  let from = 0;
  for (let i = 0; i < item.phases.length; i++) {
    const ph = item.phases[i];
    const to = ph.days === null ? Infinity : from + ph.days;
    if (n < to) return { portion: { foodId: item.foodId, measure: item.measure, qty: ph.qty }, words: portionWords(item.measure, ph.qty), dayNo: n + 1, phase: i, daysLeft: to === Infinity ? null : to - n };
    from = to;
  }
  // Every phase has ended: carry on with the last one.
  const last = item.phases[item.phases.length - 1];
  return { portion: { foodId: item.foodId, measure: item.measure, qty: last.qty }, words: portionWords(item.measure, last.qty), dayNo: n + 1, phase: item.phases.length - 1, daysLeft: null };
}

/** The entry on a day that ticks this habit off, if any. */
export const takenOn = (day: Pick<Day, "extras"> | null | undefined, id: string): ExtraEntry | undefined => (day?.extras ?? []).find((x) => x.dailyId === id);

/** The extras he added himself: the ticked habits are shown as their own chips, not as extras. */
export const ownExtras = (extras: ExtraEntry[] | undefined) => (extras ?? []).filter((x) => !x.dailyId);

/** A standard psyllium habit: 1 tsp a day for two weeks, then 1 tbsp. */
export function psylliumHabit(startDate: string, firstDays = 14): DailyItem {
  return { id: "daily-psyllium", foodId: "psyllium", startDate, measure: "1 tsp", phases: [{ days: firstDays, qty: 1 }, { days: null, qty: 3 }] };
}
