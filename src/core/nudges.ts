// Quiet prompts on Today: a Sunday look-back at the week, and a monthly backup reminder.
// Each can be put away for now; neither ever blocks anything.

export interface Nudges {
  /** The Sunday (YYYY-MM-DD) the look-back was last put away. */
  lookbackOn?: string;
  /** Don't mention backups again until after this date (YYYY-MM-DD). */
  backupUntil?: string;
}

const DAY = 86_400_000;

/** Sunday, and enough recorded days that a look-back says something. */
export function lookbackDue(todayIso: string, nudges: Nudges | undefined, recordedDays: number): boolean {
  const isSunday = new Date(todayIso + "T12:00:00").getDay() === 0;
  return isSunday && nudges?.lookbackOn !== todayIso && recordedDays >= 3;
}

/**
 * A backup is worth asking for once there's something to lose (a week of days) and the last
 * one was more than a month ago, or there has never been one.
 */
export function backupDue(todayIso: string, lastBackupAt: string | undefined, nudges: Nudges | undefined, recordedDays: number): { due: boolean; ageDays: number | null } {
  const ageDays = lastBackupAt ? Math.floor((Date.parse(todayIso + "T12:00:00") - Date.parse(lastBackupAt)) / DAY) : null;
  const snoozed = !!nudges?.backupUntil && todayIso <= nudges.backupUntil;
  const stale = ageDays === null || ageDays >= 30;
  return { due: recordedDays >= 7 && stale && !snoozed, ageDays };
}

export function backupAgeWords(ageDays: number | null): string {
  if (ageDays === null) return "You haven't made a backup yet.";
  if (ageDays < 14) return `Last backup: ${ageDays} days ago.`;
  return `Last backup: ${Math.round(ageDays / 7)} weeks ago.`;
}
