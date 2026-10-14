// The notification bell: one place for everything the app wants to tell you.
// Items are worked out from the app's state each time, so they vanish when resolved.
// Only "read" is remembered, by item id.

export type InboxKind = "update" | "newmeals" | "shopping" | "low" | "refill" | "labs" | "lookback" | "backup";

export interface InboxAction {
  key: "open" | "dismiss";
  label: string;
}

export interface InboxItem {
  /** Stable while the situation is the same; changes when it's news again. */
  id: string;
  kind: InboxKind;
  title: string;
  detail: string;
  actions: InboxAction[];
}

export interface InboxInput {
  todayIso: string;
  /** A newer build's id, when one has been published. */
  updateId: string | null;
  updateNote?: string;
  newMealCount: number;
  /** Tomorrow's shortfall by name, only those not already on the list. Null when it isn't worked out yet. */
  tomorrowNeeds: string[] | null;
  tomorrowDate: string;
  lowNames: string[];
  med: { id: string; pillsLeft: number; perDay: number } | null;
  lastLabDate: string | null;
  lookback: { headline: string; tip?: string } | null;
  backup: { due: boolean; words: string };
}

const REFILL_DAYS = 7;
const LAB_MONTHS = 6;

const list = (names: string[], n = 3) => names.slice(0, n).join(", ") + (names.length > n ? ` and ${names.length - n} more` : "");
const monthYear = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

export function buildInbox(i: InboxInput): InboxItem[] {
  const out: InboxItem[] = [];

  if (i.updateId) {
    out.push({ id: `update:${i.updateId}`, kind: "update", title: "A new version is ready", detail: i.updateNote ?? "Update to get the latest.", actions: [{ key: "open", label: "Update now" }] });
  }
  if (i.newMealCount > 0) {
    out.push({
      id: `newmeals:${i.newMealCount}`, kind: "newmeals",
      title: `${i.newMealCount} new ${i.newMealCount === 1 ? "meal" : "meals"} unlocked`,
      detail: "Have a look before they join your rotation.",
      actions: [{ key: "open", label: "Preview" }],
    });
  }
  if (i.tomorrowNeeds && i.tomorrowNeeds.length > 0) {
    const n = i.tomorrowNeeds.length;
    out.push({
      id: `shop:${i.tomorrowDate}:${n}`, kind: "shopping",
      title: `Tomorrow needs ${n} ${n === 1 ? "thing" : "things"}`,
      detail: list(i.tomorrowNeeds),
      actions: [{ key: "open", label: "Add to list" }],
    });
  }
  if (i.lowNames.length > 0) {
    out.push({
      id: `low:${i.lowNames.length}`, kind: "low",
      title: `${i.lowNames.length} ${i.lowNames.length === 1 ? "thing is" : "things are"} running low`,
      detail: list(i.lowNames),
      actions: [{ key: "open", label: "See pantry" }],
    });
  }
  if (i.med && i.med.perDay > 0) {
    const days = Math.floor(i.med.pillsLeft / i.med.perDay);
    if (days <= REFILL_DAYS) {
      out.push({
        id: `refill:${i.med.id}:${Math.ceil(days / 3)}`, kind: "refill",
        title: days <= 0 ? "Out of tablets" : `Tablets: ${days} ${days === 1 ? "day" : "days"} left`,
        detail: "Time to ask for a refill.",
        actions: [{ key: "open", label: "Open Me" }],
      });
    }
  }
  if (i.lastLabDate) {
    const months = (Date.parse(i.todayIso + "T12:00:00") - Date.parse(i.lastLabDate + "T12:00:00")) / (30.44 * 86_400_000);
    if (months >= LAB_MONTHS) {
      out.push({
        id: `labs:${i.lastLabDate}`, kind: "labs",
        title: "Time for a blood test?",
        detail: `Your last result was ${monthYear(i.lastLabDate)}.`,
        actions: [{ key: "open", label: "Add a result" }],
      });
    }
  }
  if (i.lookback) {
    out.push({
      id: `lookback:${i.todayIso}`, kind: "lookback", title: "Your week",
      detail: i.lookback.tip ? `${i.lookback.headline} ${i.lookback.tip}` : i.lookback.headline,
      actions: [{ key: "open", label: "See the summary" }, { key: "dismiss", label: "Not now" }],
    });
  }
  if (i.backup.due) {
    out.push({
      id: `backup:${i.todayIso.slice(0, 7)}`, kind: "backup", title: "Back up your data", detail: i.backup.words,
      actions: [{ key: "open", label: "Back up now" }, { key: "dismiss", label: "Remind me next week" }],
    });
  }
  return out;
}

export const unreadOf = (items: InboxItem[], read: string[] | undefined) => items.filter((x) => !(read ?? []).includes(x.id));
