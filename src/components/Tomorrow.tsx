import { useState } from "react";
import { motion } from "motion/react";
import { suppers } from "../core/content";
import type { DayState } from "../core/score";
import type { TomorrowPlan } from "../core/tomorrow";
import { SLOTS } from "../core/planner";
import { PLATES, type Plate } from "../data/meals";
import { foodMap, mealMap } from "../app/viewModel";
import { Sheet } from "./Sheets";

export interface SupperNow { supperId: string; plate: Plate }

interface Props {
  title: string;
  plan: TomorrowPlan;
  /** Foods already on the shopping list. */
  listed: Set<string>;
  prepDone: string[];
  onTogglePrep: (mealId: string) => void;
  onAddNeeds: () => void;
  supper: SupperNow | null;
  onSupper: () => void;
  /** How today went, shown as a small quiet dot; null hides it. */
  dot: DayState | null;
}

const DOT_WORDS: Record<DayState, string> = { none: "", partial: "Today was partly recorded", green: "Today went well", yellow: "Today was mixed", red: "Today was a tough one" };

/** What tomorrow needs from tonight: prep, shopping, and the meals themselves. */
export function TomorrowPanel(p: Props) {
  const prep = p.plan.prep;
  const needs = p.plan.needs;
  const jobs = prep.length + (needs.length ? 1 : 0);
  const allListed = needs.length > 0 && needs.every((n) => p.listed.has(n.foodId));
  const supperName = p.supper ? suppers.find((s) => s.id === p.supper!.supperId)?.name : null;

  return (
    <motion.div className="tomorrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="tomorrow-head">
        <h2>{p.title}</h2>
        {p.dot && p.dot !== "none" && <span className={`tdot dot-${p.dot}`} role="img" aria-label={DOT_WORDS[p.dot]} />}
      </div>
      <p className="k-sub">{jobs === 0 ? "Nothing to prep and nothing to buy." : jobs === 1 ? "One small job and tomorrow is sorted." : "A couple of small jobs and tomorrow is sorted."}</p>

      {prep.length > 0 && (
        <section>
          <h3 className="section-label">Tonight, about 2 minutes</h3>
          <div className="nudge">
            {prep.map((t) => {
              const done = p.prepDone.includes(t.mealId);
              return (
                <button key={t.mealId} className="prep-row" aria-pressed={done} onClick={() => p.onTogglePrep(t.mealId)}>
                  <span className={done ? "tick d" : "tick"} aria-hidden="true">{done ? "✓" : ""}</span>
                  <span className="prep-txt"><b>{t.text}</b><small>{t.detail}</small></span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {needs.length > 0 && (
        <section>
          <h3 className="section-label">Pick up for tomorrow</h3>
          <div className="nudge">
            <span>{needs.slice(0, 3).map((n) => foodMap.get(n.foodId)?.name ?? n.foodId).join(", ")}{needs.length > 3 ? ` and ${needs.length - 3} more` : ""}</span>
            <button className={allListed ? "btn small ghost" : "btn small"} disabled={allListed} onClick={p.onAddNeeds}>
              {allListed ? "On your list" : `Add ${needs.length} to your list`}
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="section-label">Tomorrow</h3>
        <div className="nudge">
          {SLOTS.map((s) => {
            const m = p.plan.plan[s] ? mealMap.get(p.plan.plan[s]!) : null;
            return m ? (
              <div key={s} className="row-between"><span>{m.emoji} {m.name}</span><span className="sub">{s}</span></div>
            ) : (
              <div key={s} className="row-between"><span className="sub">Nothing fits yet</span><span className="sub">{s}</span></div>
            );
          })}
          {p.plan.source === "dealt" && <small className="sub">A guess from what's in the kitchen. Plan the week to settle it.</small>}
        </div>
      </section>

      <button className="link supper-link" onClick={p.onSupper}>
        {supperName ? `Supper: ${supperName}, ${p.supper!.plate.toLowerCase()} plate. Change` : "What's supper tonight? Tell me now"}
      </button>
    </motion.div>
  );
}

/** Pick what tonight's supper is (and how big) now, so tomorrow's check-in is already answered. */
export function SupperNowSheet({ open, current, onClose, onSave, onClear }: { open: boolean; current: SupperNow | null; onClose: () => void; onSave: (s: SupperNow) => void; onClear: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="What's supper tonight?">
      {open && <SupperForm current={current} onSave={onSave} onClear={onClear} />}
    </Sheet>
  );
}

export function SupperForm({ current, onSave, onClear }: { current: SupperNow | null; onSave: (s: SupperNow) => void; onClear: () => void }) {
  const [chosen, setChosen] = useState<string | null>(current?.supperId ?? null);
  const [plate, setPlate] = useState<Plate>(current?.plate ?? "Normal");
  return (
    <>
      {(["Home", "Takeaway"] as const).map((g) => (
        <section key={g} className="checkin-group">
          <h3 className="section-label">{g === "Home" ? "Home-cooked" : "Takeaway"}</h3>
          <div className="supper-grid compact">
            {suppers.filter((s) => s.group === g).map((s) => (
              <motion.button key={s.id} className="supper-opt" aria-pressed={chosen === s.id} whileTap={{ scale: 0.94 }} onClick={() => setChosen(s.id)}>
                <span className="emoji">{s.emoji}</span>
                <span>{s.name}</span>
              </motion.button>
            ))}
          </div>
        </section>
      ))}
      <h3 className="section-label">How big a plate?</h3>
      <div className="seg seg-3" role="group" aria-label="Plate size">
        {(Object.keys(PLATES) as Plate[]).map((p) => (<button key={p} aria-pressed={plate === p} onClick={() => setPlate(p)}>{p}</button>))}
      </div>
      <div className="sheet-actions">
        {current && <button className="btn ghost" onClick={onClear}>Not decided</button>}
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!chosen} onClick={() => chosen && onSave({ supperId: chosen, plate })}>{chosen ? "Save" : "Pick one"}</motion.button>
      </div>
    </>
  );
}
