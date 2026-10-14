import { useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { toast } from "sonner";
import { ANCHOR_WORDS, stateWord, summarise, type DayScore, type DayState } from "../core/score";
import type { Day, Lab, Med } from "../core/types";
import { addDays, foodMap, iso, lastDates, mealMap, scoreDate } from "../app/history";
import { Sheet } from "./Sheets";

type Section = "days" | "summary" | "results";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "summary", label: "Summary" },
];

interface Props {
  days: Day[];
  med: Med | null;
  labs: Lab[];
  satCap: number;
  onSaveLab: (l: Lab) => void;
  onDeleteLab: (date: string) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
const LEGEND: { s: DayState; label: string }[] = [
  { s: "none", label: "Nothing recorded" }, { s: "green", label: "Went well" }, { s: "yellow", label: "Mixed" }, { s: "red", label: "Tough" },
];

export function Progress({ days, med, labs, satCap, onSaveLab, onDeleteLab }: Props) {
  const [section, setSection] = useState<Section>("days");
  const [open, setOpen] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [labSheet, setLabSheet] = useState<Lab | "new" | null>(null);

  const today = iso(new Date());
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const score = (d: string) => scoreDate(d, byDate, satCap, med);
  const go = (s: Section) => { setSection(s); window.scrollTo({ top: 0 }); };

  return (
    <div className="kitchen">
      <header><h1 className="hello">Progress</h1></header>

      <div className="seg seg-2" role="group" aria-label="Progress sections">
        <LayoutGroup id="progress-seg">
          {SECTIONS.map((s) => (
            <button key={s.key} aria-pressed={section === s.key} onClick={() => go(s.key)}>
              {section === s.key && <motion.span layoutId="p-thumb" className="seg-thumb" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="seg-label">{s.label}</span>
            </button>
          ))}
        </LayoutGroup>
      </div>

      {section === "days" && <DaysGrid today={today} score={score} onOpen={setOpen} hasMed={!!med} />}

      {section === "summary" && (
        <SummaryView period={period} setPeriod={setPeriod} today={today} score={score} labs={labs} onAddLab={() => setLabSheet("new")} onAllLabs={() => go("results")} />
      )}

      {section === "results" && (
        <ResultsView labs={labs} onAdd={() => setLabSheet("new")} onOpen={setLabSheet} onBack={() => go("summary")} />
      )}

      <DaySheet date={open} score={open ? score(open) : null} onClose={() => setOpen(null)} />
      <LabSheet seed={labSheet} onClose={() => setLabSheet(null)} onSave={(l) => { onSaveLab(l); setLabSheet(null); toast("Result saved"); }} onDelete={(d) => { onDeleteLab(d); setLabSheet(null); }} today={today} />
    </div>
  );
}

/* ── days ──────────────────────────────────────────────────── */

function DaysGrid({ today, score, onOpen, hasMed }: { today: string; score: (d: string) => DayScore; onOpen: (d: string) => void; hasMed: boolean }) {
  // Five weeks, Monday first, ending with the week that holds today.
  const t = new Date(today + "T12:00:00");
  const mondayOffset = (t.getDay() + 6) % 7;
  const start = addDays(today, -(mondayOffset + 28));
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  return (
    <section className="k-section">
      <p className="k-sub">Each dot is a day. Tap one to see how it went.</p>
      <div className="dots-head" aria-hidden="true">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="dots">
        {cells.map((d) => {
          if (d > today) return <span key={d} className="dot-gap" />;
          const s = score(d);
          const label = `${longDate(d)}: ${stateWord(s)}${s.meds?.done ? ", tablet taken" : ""}`;
          return (
            <button key={d} className={`dot dot-${s.state}${d === today ? " today" : ""}`} aria-label={label} onClick={() => onOpen(d)}>
              <span>{Number(d.slice(8))}</span>
              {s.meds?.done && <i className="dot-med" aria-hidden="true">✓</i>}
            </button>
          );
        })}
      </div>
      <div className="legend">
        {LEGEND.map((l) => (<span key={l.s}><i className={`swatch dot-${l.s}`} />{l.label}</span>))}
        {hasMed && <span><i className="dot-med inline">✓</i>Tablet taken</span>}
      </div>
    </section>
  );
}

function DaySheet({ date, score, onClose }: { date: string | null; score: DayScore | null; onClose: () => void }) {
  return (
    <Sheet open={!!date && !!score} onOpenChange={(o) => !o && onClose()} title={date ? longDate(date) : ""}>
      {date && score && (
        <>
          <div className="day-top">
            <span className={`swatch big dot-${score.state}`} />
            <div>
              <b>{stateWord(score)}</b>
              <span>{score.points !== null ? `Score ${score.points} of 100` : "No meals were ticked off"}</span>
            </div>
          </div>
          {score.eaten.length > 0 && (
            <ul className="items">
              {score.eaten.map((e) => (
                <li key={e.slot} className="item"><span className="emoji">{e.emoji}</span><span className="what">{e.name}</span><span className="pill">{e.slot}</span></li>
              ))}
            </ul>
          )}
          <ul className="reasons">
            {score.notes.map((n) => (<li key={n}>{n}</li>))}
            {score.supper && <li>Supper: {score.supper.name}{score.supper.takeaway ? " (takeaway)" : ""}.</li>}
            {score.meds && <li>{score.meds.done ? "Tablet taken." : score.meds.taken > 0 ? `Tablet: ${score.meds.taken} of ${score.meds.expected} doses.` : "Tablet wasn't ticked."}</li>}
            {score.moved && <li>You moved today.</li>}
          </ul>
          {score.state !== "none" && (
            <div className="anchors">
              {(Object.keys(ANCHOR_WORDS) as (keyof typeof ANCHOR_WORDS)[]).map((a) => (
                <span key={a} className={score.anchors.includes(a) ? "tag on" : "tag"}>{score.anchors.includes(a) ? "✓" : "–"} {ANCHOR_WORDS[a]}</span>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ── summary ───────────────────────────────────────────────── */

function SummaryView({ period, setPeriod, today, score, labs, onAddLab, onAllLabs }: { period: "week" | "month"; setPeriod: (p: "week" | "month") => void; today: string; score: (d: string) => DayScore; labs: Lab[]; onAddLab: () => void; onAllLabs: () => void }) {
  const n = period === "week" ? 7 : 30;
  const scores = useMemo(() => lastDates(today, n).map(score), [today, n, score]);
  const sum = useMemo(() => summarise(scores, mealMap, foodMap, period), [scores, period]);
  return (
    <section className="k-section">
      <div className="seg seg-2" role="group" aria-label="Period">
        <button aria-pressed={period === "week"} onClick={() => setPeriod("week")}>Last 7 days</button>
        <button aria-pressed={period === "month"} onClick={() => setPeriod("month")}>Last 30 days</button>
      </div>

      <div className="week-summary">
        <b>{sum.headline}</b>
        <div className={`strip strip-${n}`} aria-hidden="true">{scores.map((x, i) => <i key={i} className={`swatch dot-${x.state}`} />)}</div>
        {n > 7 && <small className="strip-note">Oldest first. The last one is today.</small>}
      </div>

      {sum.recorded > 0 && (
        <div className="nums me-targets">
          <div><dt>Sat fat a day</dt><dd>{sum.avgSat} g</dd></div>
          <div><dt>Sol. fibre a day</dt><dd>{sum.avgFibre} g</dd></div>
          <div><dt>Sodium a day</dt><dd>{sum.avgSodium.toLocaleString("en-ZA")} mg</dd></div>
        </div>
      )}

      {sum.recorded >= 3 && (
        <ul className="reasons">
          <li>Oats or barley on {sum.anchorDays.betaGlucan} of {sum.recorded} days.</li>
          <li>Beans or lentils on {sum.anchorDays.legume} of {sum.recorded} days.</li>
          <li>Nuts or seeds on {sum.anchorDays.nuts} of {sum.recorded} days.</li>
          {sum.medDays && <li>Tablet ticked on {sum.medDays.taken} of {sum.medDays.expected} days.</li>}
          <li>Moved on {sum.movedDays} of {sum.days} days.</li>
        </ul>
      )}

      <h3 className="section-label">Worth trying</h3>
      {sum.suggestions.map((t) => (<p key={t} className="suggest">{t}</p>))}
      <p className="k-sub">General guidance from what you've recorded, not medical advice. Your doctor's view comes first.</p>

      <BloodCard labs={labs} onAdd={onAddLab} onAll={onAllLabs} />
    </section>
  );
}

/* ── results ───────────────────────────────────────────────── */

/** Blood tests are rare, so this is a quiet card at the bottom of the summary, not a screen of its own. */
function BloodCard({ labs, onAdd, onAll }: { labs: Lab[]; onAdd: () => void; onAll: () => void }) {
  const last = labs[labs.length - 1];
  const prev = labs[labs.length - 2];
  return (
    <div className="blood-card">
      <h3 className="section-label">Blood results</h3>
      {last ? (
        <p>
          <b>LDL {mmol(last.ldl)}</b> mmol/L on {shortDate(last.date)}
          {prev && <> ({last.ldl - prev.ldl > 0 ? "up" : "down"} {Math.abs(Math.round((last.ldl - prev.ldl) * 10) / 10)} since {shortDate(prev.date)})</>}
        </p>
      ) : (
        <p>Nothing here yet. Add a result whenever you get one; once or twice a year is plenty.</p>
      )}
      <div className="blood-actions">
        <button className="btn small" onClick={onAdd}>Add a result</button>
        {labs.length > 0 && <button className="btn small ghost" onClick={onAll}>See all {labs.length}</button>}
      </div>
    </div>
  );
}

const num = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) && v.trim() !== "" ? n : undefined; };
const mmol = (n?: number) => (n === undefined ? "" : n.toFixed(1));

function Trend({ labs }: { labs: Lab[] }) {
  if (labs.length < 2) return null;
  const W = 320, H = 120, P = 16;
  const t = labs.map((l) => Date.parse(l.date));
  const t0 = Math.min(...t), t1 = Math.max(...t);
  const v = labs.map((l) => l.ldl);
  const lo = Math.max(0, Math.min(...v) - 0.4), hi = Math.max(...v) + 0.4;
  const x = (ms: number) => P + ((ms - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (n: number) => H - P - ((n - lo) / Math.max(0.1, hi - lo)) * (H - 2 * P);
  const pts = labs.map((l) => `${x(Date.parse(l.date)).toFixed(1)},${y(l.ldl).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label={`LDL over time: ${labs.map((l) => `${l.ldl} on ${shortDate(l.date)}`).join(", ")}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {labs.map((l) => (
        <g key={l.date}>
          <circle cx={x(Date.parse(l.date))} cy={y(l.ldl)} r="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
          <text x={x(Date.parse(l.date))} y={y(l.ldl) - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{mmol(l.ldl)}</text>
        </g>
      ))}
    </svg>
  );
}

function ResultsView({ labs, onAdd, onOpen, onBack }: { labs: Lab[]; onAdd: () => void; onOpen: (l: Lab) => void; onBack: () => void }) {
  const newest = [...labs].reverse();
  return (
    <section className="k-section">
      <button className="link" onClick={onBack}>Back to summary</button>
      <div className="k-head">
        <h3 className="section-label">Blood results</h3>
        <button className="btn small" onClick={onAdd}>Add a result</button>
      </div>
      {labs.length === 0 ? (
        <p className="k-empty">Add your results when you get them. LDL is the one that matters most. Your own numbers, from your own lab report, are the only LDL figures this app will ever show.</p>
      ) : (
        <>
          <Trend labs={labs} />
          {newest.map((l, i) => {
            const prev = newest[i + 1];
            const diff = prev ? Math.round((l.ldl - prev.ldl) * 10) / 10 : null;
            return (
              <button key={l.date} className="lab-row" onClick={() => onOpen(l)}>
                <span className="lab-ldl"><b>{mmol(l.ldl)}</b><small>LDL mmol/L</small></span>
                <span className="lab-meta">
                  <b>{shortDate(l.date)}</b>
                  <small>
                    {[l.total !== undefined && `Total ${mmol(l.total)}`, l.hdl !== undefined && `HDL ${mmol(l.hdl)}`, l.trig !== undefined && `Trig ${mmol(l.trig)}`, l.apoB !== undefined && `ApoB ${l.apoB}`].filter(Boolean).join(" · ") || "LDL only"}
                  </small>
                </span>
                {diff !== null && <span className="pill">{diff > 0 ? "+" : ""}{diff}</span>}
              </button>
            );
          })}
        </>
      )}
      <p className="k-sub">Comparing results over time is for you and your doctor. This app doesn't judge a number.</p>
    </section>
  );
}

function LabSheet({ seed, onClose, onSave, onDelete, today }: { seed: Lab | "new" | null; onClose: () => void; onSave: (l: Lab) => void; onDelete: (d: string) => void; today: string }) {
  return (
    <Sheet open={!!seed} onOpenChange={(o) => !o && onClose()} title={seed === "new" ? "Add a blood result" : "Blood result"}>
      {seed && <LabForm key={seed === "new" ? "new" : seed.date} seed={seed === "new" ? null : seed} today={today} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function LabForm({ seed, today, onSave, onDelete }: { seed: Lab | null; today: string; onSave: (l: Lab) => void; onDelete: (d: string) => void }) {
  const [unit, setUnit] = useState<"mmol" | "mgdl">("mmol");
  const [date, setDate] = useState(seed?.date ?? today);
  const [f, setF] = useState({ ldl: seed ? String(seed.ldl) : "", total: seed?.total !== undefined ? String(seed.total) : "", hdl: seed?.hdl !== undefined ? String(seed.hdl) : "", trig: seed?.trig !== undefined ? String(seed.trig) : "", apoB: seed?.apoB !== undefined ? String(seed.apoB) : "", note: seed?.note ?? "" });
  const k = (kind: "chol" | "trig") => (unit === "mmol" ? 1 : kind === "chol" ? 0.02586 : 0.01129);
  const r2 = (n?: number) => (n === undefined ? undefined : Math.round(n * 100) / 100);
  const lab: Lab | null = (() => {
    const ldl = num(f.ldl);
    if (ldl === undefined || ldl <= 0 || ldl > 15 * (unit === "mmol" ? 1 : 40)) return null;
    const conv = (v: string, kind: "chol" | "trig") => { const n = num(v); return n === undefined ? undefined : r2(n * k(kind)); };
    return { date, ldl: r2(ldl * k("chol"))!, total: conv(f.total, "chol"), hdl: conv(f.hdl, "chol"), trig: conv(f.trig, "trig"), apoB: num(f.apoB), note: f.note.trim() || undefined };
  })();
  const field = (key: "ldl" | "total" | "hdl" | "trig" | "apoB", label: string, hint: string) => (
    <label className="me-field">
      <span className="me-label">{label}</span>
      <span className="me-input"><input inputMode="decimal" value={f[key]} placeholder={hint} aria-label={label} onChange={(e) => setF({ ...f, [key]: e.target.value.replace(/[^0-9.,]/g, "") })} /><span>{key === "apoB" ? "g/L" : unit === "mmol" ? "mmol/L" : "mg/dL"}</span></span>
    </label>
  );
  return (
    <>
      <p className="k-sub">Copy the numbers from your lab report. Only LDL is needed.</p>
      <label className="me-field"><span className="me-label">Date of the blood test</span><span className="me-input"><input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date of the blood test" /></span></label>
      <div className="seg seg-2" role="group" aria-label="Units">
        <button aria-pressed={unit === "mmol"} onClick={() => setUnit("mmol")}>mmol/L</button>
        <button aria-pressed={unit === "mgdl"} onClick={() => setUnit("mgdl")}>mg/dL</button>
      </div>
      {field("ldl", "LDL cholesterol", unit === "mmol" ? "e.g. 3.8" : "e.g. 147")}
      <div className="me-grid two">
        {field("total", "Total", unit === "mmol" ? "5.9" : "228")}
        {field("hdl", "HDL", unit === "mmol" ? "1.2" : "46")}
        {field("trig", "Triglycerides", unit === "mmol" ? "1.4" : "124")}
        {field("apoB", "ApoB", "optional")}
      </div>
      <label className="me-field"><span className="me-label">Note</span><span className="me-input"><input value={f.note} placeholder="e.g. fasting, after 3 months" aria-label="Note" onChange={(e) => setF({ ...f, note: e.target.value })} /></span></label>
      <div className="sheet-actions">
        {seed && <button className="btn ghost" onClick={() => onDelete(seed.date)}>Remove</button>}
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!lab} onClick={() => lab && onSave(lab)}>{lab ? "Save result" : "Enter the LDL"}</motion.button>
      </div>
    </>
  );
}

