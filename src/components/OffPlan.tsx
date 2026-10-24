import { useState } from "react";
import { motion } from "motion/react";
import { EXTRA_OPTIONS, REPLACE_OPTIONS, SIZE_LABEL, type OffOption, type OffSize } from "../core/offplan";
import { Sheet } from "./Sheets";

export type OffPlanTarget = { mode: "replace"; slot: string; slotLabel: string } | { mode: "extra" } | null;

const SIZES = Object.keys(SIZE_LABEL) as Exclude<OffSize, "skipped">[];

/**
 * "Had something else" for a slot, or "+ Extra" on top of the plan. Pick what it was and how
 * much; the rest of the day rebalances around it.
 */
export function OffPlanSheet({ target, onClose, onSave }: { target: OffPlanTarget; onClose: () => void; onSave: (what: string, size: OffSize) => void }) {
  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()} title={target?.mode === "replace" ? `What did you have for ${target.slotLabel.toLowerCase()}?` : "What was the extra?"}>
      {target && <OffPlanForm key={target.mode === "replace" ? target.slot : "extra"} target={target} onSave={onSave} />}
    </Sheet>
  );
}

export function OffPlanForm({ target, onSave }: { target: NonNullable<OffPlanTarget>; onSave: (what: string, size: OffSize) => void }) {
  const options = target.mode === "replace" ? REPLACE_OPTIONS : EXTRA_OPTIONS;
  const groups = [...new Set(options.map((o) => o.group))];
  const [what, setWhat] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [size, setSize] = useState<Exclude<OffSize, "skipped">>("normal");
  const label = typed.trim() || what;

  return (
    <>
      {target.mode === "replace" && (
        <div className="checkin-opts">
          <motion.button className="checkin-opt" whileTap={{ scale: 0.97 }} onClick={() => onSave("Skipped", "skipped")}>
            <span className="checkin-icon"><span className="emoji">⏭️</span></span>
            <span className="checkin-txt"><b>Skipped it</b><span>Nothing for this one</span></span>
          </motion.button>
        </div>
      )}
      {groups.map((g) => (
        <section key={g} className="checkin-group">
          <h3 className="section-label">{g}</h3>
          <div className="checkin-opts">
            {options.filter((o: OffOption) => o.group === g).map((o) => (
              <motion.button key={o.label} className="checkin-opt" aria-pressed={!typed && what === o.label} whileTap={{ scale: 0.97 }} onClick={() => { setWhat(o.label); setTyped(""); }}>
                <span className="checkin-icon"><span className="emoji">{o.emoji}</span></span>
                <span className="checkin-txt"><b>{o.label}</b></span>
              </motion.button>
            ))}
          </div>
        </section>
      ))}
      <label className="me-field">
        <span className="me-label">Something else</span>
        <span className="me-input"><input value={typed} placeholder="Type what it was" aria-label="Something else" onChange={(e) => { setTyped(e.target.value); }} /></span>
      </label>
      <h3 className="section-label">How much?</h3>
      <div className="seg seg-3" role="group" aria-label="Portion size">
        {SIZES.map((z) => (<button key={z} aria-pressed={size === z} onClick={() => setSize(z)}>{SIZE_LABEL[z]}</button>))}
      </div>
      <div className="sheet-actions">
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!label} onClick={() => label && onSave(label, size)}>{label ? "Save" : "Pick one"}</motion.button>
      </div>
    </>
  );
}
