// A small RFC 5545 calendar file: weekly "plan your week", daily fibre snack, optional daily tablet.
// iOS Calendar imports it once and does the reminding, which is why reminders aren't web push.

export interface IcsOptions {
  /** "HH:MM" local time for the Sunday planning reminder, e.g. "18:00". */
  planTime: string;
  /** "HH:MM" for the daily fibre snack, e.g. "16:30". */
  snackTime: string;
  /** "HH:MM" for the daily tablet. Omit if there's no medication to remind about. */
  tabletTime?: string;
  /** Several doses a day: one reminder per time. Takes precedence over `tabletTime`. */
  tabletTimes?: string[];
  /** First day the events may start on (local date). The Sunday event begins on the next Sunday. */
  start: Date;
  /** IANA zone the times are in. Only Africa/Johannesburg has a VTIMEZONE block (UTC+2, no DST). */
  tz?: string;
  /** Overridable for tests. */
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock stamp "YYYYMMDDTHHMMSS" from the date's *local* parts — never converted to UTC. */
function localStamp(day: Date, hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`Bad time "${hhmm}", expected HH:MM`);
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}T${pad(+m[1])}${m[2]}00`;
}

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const encoder = new TextEncoder();

/** Fold at 75 octets, never inside a multi-byte character; continuation lines start with a space. */
export function fold(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // a continuation's leading space counts as one
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : " " + l));
}

const VTIMEZONE_JHB = [
  "BEGIN:VTIMEZONE",
  "TZID:Africa/Johannesburg",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0200",
  "TZNAME:SAST",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function event(kind: string, summary: string, dtstart: string, tz: string, rrule: string, now: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:pocket-deck-${kind}@local`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${tz}:${dtstart}`,
    "DURATION:PT15M",
    `RRULE:${rrule}`,
    `SUMMARY:${summary}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
  ];
}

export function buildIcs(o: IcsOptions): string {
  const tz = o.tz ?? "Africa/Johannesburg";
  if (tz !== "Africa/Johannesburg") throw new Error(`No timezone definition for ${tz}`);
  const stamp = utcStamp(o.now ?? new Date());

  const sunday = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
  const first = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pocket Deck//Reminders//EN",
    "CALSCALE:GREGORIAN",
    ...VTIMEZONE_JHB,
    ...event("plan", "Plan your week", localStamp(sunday, o.planTime), tz, "FREQ=WEEKLY;BYDAY=SU", stamp),
    ...event("snack", "Fibre snack", localStamp(first, o.snackTime), tz, "FREQ=DAILY", stamp),
    ...(o.tabletTimes ?? (o.tabletTime ? [o.tabletTime] : [])).flatMap((t, i) =>
      event(i === 0 ? "tablet" : `tablet-${i + 1}`, "Tablet", localStamp(first, t), tz, "FREQ=DAILY", stamp)),
    "END:VCALENDAR",
  ];
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}
