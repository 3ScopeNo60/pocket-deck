// A one-page summary Levi can show or send his doctor: blood results and a plain picture of
// eating, medication and movement over a period. Numbers only, no advice.
import type { Anchor, Lab, Med } from "./types";
import type { PeriodSummary } from "./score";

export interface DoctorInput {
  /** YYYY-MM-DD for the date the summary is made. */
  today: string;
  /** How many days the period covers. */
  days: number;
  summary: PeriodSummary;
  labs: Lab[];
  med: Pick<Med, "name" | "dose" | "times" | "perDose"> | null;
  satCap: number;
}

export interface DoctorSection { title: string; rows: string[] }
export interface DoctorSummary { heading: string; sections: DoctorSection[]; footer: string }

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
const fmt = (n?: number) => (n === undefined ? "" : n.toFixed(1));
const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

const ANCHOR: Record<Anchor, string> = { betaGlucan: "oats or barley", legume: "beans or lentils", nuts: "nuts or seeds", goodFat: "olive oil, avocado or oily fish" };

export function doctorSummary(i: DoctorInput): DoctorSummary {
  const s = i.summary;
  const sections: DoctorSection[] = [];

  // Blood results first: it's the part a doctor reads for.
  const labs = [...i.labs].sort((a, b) => a.date.localeCompare(b.date));
  if (labs.length) {
    const rows = labs.map((l) => {
      const parts = [`LDL ${fmt(l.ldl)}`, l.total !== undefined && `total ${fmt(l.total)}`, l.hdl !== undefined && `HDL ${fmt(l.hdl)}`, l.trig !== undefined && `triglycerides ${fmt(l.trig)}`, l.apoB !== undefined && `ApoB ${l.apoB} g/L`].filter(Boolean);
      return `${longDate(l.date)}: ${parts.join(", ")} (mmol/L)`;
    });
    if (labs.length >= 2) {
      const first = labs[0], last = labs[labs.length - 1];
      const d = Math.round((last.ldl - first.ldl) * 10) / 10;
      rows.push(`LDL ${d === 0 ? "unchanged" : `${d < 0 ? "down" : "up"} ${Math.abs(d)} mmol/L`} between ${longDate(first.date)} and ${longDate(last.date)}.`);
    }
    sections.push({ title: "Blood results", rows });
  } else {
    sections.push({ title: "Blood results", rows: ["No results entered yet."] });
  }

  if (s.recorded === 0) {
    sections.push({ title: `Eating, last ${i.days} days`, rows: ["Nothing was recorded in this period."] });
  } else {
    sections.push({
      title: `Eating, last ${i.days} days`,
      rows: [
        `${s.recorded} of ${s.days} days recorded.`,
        `Saturated fat averaged ${s.avgSat} g a day on the daytime meals (daily limit used: ${Math.round(i.satCap * 10) / 10} g including supper).`,
        `Soluble fibre averaged ${s.avgFibre} g a day from the daytime meals.`,
        `Sodium averaged ${s.avgSodium.toLocaleString("en-ZA")} mg a day from the daytime meals.`,
        ...(Object.keys(ANCHOR) as Anchor[]).map((a) => `${ANCHOR[a][0].toUpperCase()}${ANCHOR[a].slice(1)}: ${s.anchorDays[a]} of ${s.recorded} days (${pct(s.anchorDays[a], s.recorded)}).`),
        `Takeaway suppers: ${s.takeaways}.`,
        `Days rated on track: ${s.counts.green}; mixed: ${s.counts.yellow}; off track: ${s.counts.red}.`,
      ],
    });
  }

  const med: string[] = [];
  if (i.med) {
    const per = i.med.perDose && i.med.perDose > 1 ? ` x${i.med.perDose}` : "";
    const times = i.med.times?.length ? `, ${i.med.times.length} time${i.med.times.length === 1 ? "" : "s"} a day` : "";
    med.push(`${i.med.name || "Medication"}${i.med.dose ? ` ${i.med.dose}` : ""}${per}${times}.`);
    if (s.medDays) med.push(`All doses ticked on ${s.medDays.taken} of ${s.medDays.expected} days (${pct(s.medDays.taken, s.medDays.expected)}).`);
  } else {
    med.push("No medication entered.");
  }
  sections.push({ title: "Medication", rows: med });
  sections.push({ title: "Movement", rows: [`Moved on ${s.movedDays} of ${s.days} days.`] });

  return {
    heading: `Pocket Deck summary, ${longDate(i.today)}`,
    sections,
    footer: "Self-recorded and estimated from a food database; not a clinical measurement. Daytime meals only: supper is estimated from what was logged the next morning.",
  };
}

export function toText(d: DoctorSummary): string {
  return [d.heading, "", ...d.sections.flatMap((s) => [s.title.toUpperCase(), ...s.rows.map((r) => `- ${r}`), ""]), d.footer].join("\n");
}
