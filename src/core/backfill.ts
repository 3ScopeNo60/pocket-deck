// Logging what you ate after the day: which days can still be filled in, and which slots are open.
import { doneSlots } from "./offplan";
import type { Day } from "./types";

export const SLOTS = ["breakfast", "lunch", "snack"] as const;
export type BackSlot = (typeof SLOTS)[number];

/** How many days back can be filled in: yesterday and the day before. */
export const BACKFILL_DAYS = 2;

const shift = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};

/** The days that can be filled in, most recent first. Today has its own screen. */
export function backfillDates(today: string): string[] {
  return Array.from({ length: BACKFILL_DAYS }, (_, i) => shift(today, -(i + 1)));
}

export const canBackfill = (date: string, today: string) => backfillDates(today).includes(date);

export function blankDay(date: string): Day {
  return { date, lastNight: null, tonight: "normal", plan: { breakfast: null, lunch: null, snack: null }, eaten: [], extras: [], replaced: [], walk: false };
}

/** Meals neither ticked off nor swapped for something else (or skipped). */
export function missingSlots(day: Pick<Day, "eaten" | "replaced"> | undefined): BackSlot[] {
  if (!day) return [...SLOTS];
  const done = doneSlots(day);
  return SLOTS.filter((s) => !done.includes(s));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export interface BacklogNudge {
  date: string;
  /** "Yesterday" or the weekday. */
  when: string;
  missing: BackSlot[];
}

/**
 * The most recent day still open to fill in that has meals missing. Only once tracking has begun
 * (a day on or before it exists), so a brand-new install isn't nagged about days before it.
 */
export function backlogNudge(today: string, days: Day[]): BacklogNudge | null {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = days.reduce<string | null>((m, d) => (m === null || d.date < m ? d.date : m), null);
  for (const date of backfillDates(today)) {
    if (first === null || date < first) continue;
    const missing = missingSlots(byDate.get(date));
    if (missing.length === 0) continue;
    const when = date === shift(today, -1) ? "Yesterday" : new Date(date + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "long" });
    return { date, when, missing };
  }
  return null;
}

export const slotWords = (slots: BackSlot[]) => {
  const w = slots.map(cap);
  return w.length === 1 ? w[0] : w.length === 2 ? `${w[0]} and ${w[1].toLowerCase()}` : `${w[0]}, ${w[1].toLowerCase()} and ${w[2].toLowerCase()}`;
};
