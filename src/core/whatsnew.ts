// "What's new": the newest release is "In this update"; older ones are folded under their day.
export interface Release { id: string; date: string; notes: string[] }

export interface DayGroup { date: string; notes: string[] }

/** The first `fresh` releases are new to this phone; the rest are grouped by day, newest first. */
export function groupReleases(releases: Release[], fresh: number): { fresh: Release[]; days: DayGroup[] } {
  const n = Math.max(1, Math.min(fresh, releases.length));
  const days: DayGroup[] = [];
  for (const r of releases.slice(n)) {
    const day = days.find((d) => d.date === r.date);
    if (day) day.notes.push(...r.notes);
    else days.push({ date: r.date, notes: [...r.notes] });
  }
  return { fresh: releases.slice(0, n), days };
}

/** How many releases are newer than the last one this phone saw. One when unknown. */
export function freshCount(releases: Release[], lastSeenId: string | null): number {
  const i = lastSeenId ? releases.findIndex((r) => r.id === lastSeenId) : -1;
  return i > 0 ? i : 1;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Today", "Yesterday" or "14 October". Dates are plain YYYY-MM-DD. */
export function dayLabel(date: string, today: string): string {
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const diff = Math.round((t - d) / 86_400_000);
  if (diff === 0) return "Earlier today";
  if (diff === 1) return "Yesterday";
  return `${+date.slice(8, 10)} ${MONTHS[+date.slice(5, 7) - 1]}`;
}
