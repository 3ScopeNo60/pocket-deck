import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { foods } from "../core/content";
import { EXTRA_OPTIONS, REPLACE_OPTIONS, SIZE_LABEL, portionNutrition, type OffOption, type OffSize } from "../core/offplan";
import type { Food, FoodPortion } from "../core/types";
import { foodMap } from "../app/viewModel";
import { Sheet } from "./Sheets";

export type OffPlanTarget = { mode: "replace"; slot: string; slotLabel: string } | { mode: "extra" } | null;

const SIZES = Object.keys(SIZE_LABEL) as Exclude<OffSize, "skipped">[];

/**
 * "Had something else" for a slot, or "+ Extra" on top of the plan. Pick what it was and how
 * much; the rest of the day rebalances around it.
 */
export function OffPlanSheet({ target, onClose, onSave }: { target: OffPlanTarget; onClose: () => void; onSave: (what: string, size: OffSize, food?: FoodPortion) => void }) {
  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()} title={target?.mode === "replace" ? `What did you have for ${target.slotLabel.toLowerCase()}?` : "What was the extra?"}>
      {target && <OffPlanForm key={target.mode === "replace" ? target.slot : "extra"} target={target} onSave={onSave} />}
    </Sheet>
  );
}

/** Pick a food from the food list and how much of it: every nutrient then counts, not a rough guess. */
function FoodPicker({ onSave, onBack }: { onSave: (what: string, size: OffSize, food: FoodPortion) => void; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [measure, setMeasure] = useState("");
  const [qty, setQty] = useState(1);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return foods.filter((f) => !t || f.name.toLowerCase().includes(t)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
  }, [q]);
  if (!food) {
    return (
      <>
        <input className="search" placeholder="Search your foods" aria-label="Search your foods" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pick-list">
          {list.map((f) => (
            <button key={f.id} className="krow" onClick={() => { setFood(f); setMeasure(Object.keys(f.measures)[0]); setQty(1); }}>
              <span className="emoji">{f.emoji}</span><span className="kname">{f.name}</span>
            </button>
          ))}
          {list.length === 0 && <p className="k-empty">Nothing in your food list matches.</p>}
        </div>
        <div className="sheet-actions"><button className="btn ghost" onClick={onBack}>Back</button></div>
      </>
    );
  }
  const n = portionNutrition({ foodId: food.id, measure, qty }, foodMap);
  return (
    <>
      <div className="own-row"><span className="emoji">{food.emoji}</span><span className="kname">{food.name}</span><button className="link" onClick={() => setFood(null)}>Change</button></div>
      <div className="own-row">
        <select aria-label="Measure" value={measure} onChange={(e) => setMeasure(e.target.value)}>
          {Object.keys(food.measures).map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
        <div className="stepper" role="group" aria-label="How many">
          <button aria-label="One fewer" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <b>{qty}</b>
          <button aria-label="One more" onClick={() => setQty(qty + 1)}>+</button>
        </div>
      </div>
      {n && <p className="k-sub">About {n.sol.toFixed(1)} g soluble fibre, {n.sat.toFixed(1)} g saturated fat, {Math.round(n.na)} mg sodium, {Math.round(n.kcal / 5) * 5} kcal.</p>}
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <motion.button className="btn" whileTap={{ scale: 0.96 }} onClick={() => onSave(`${qty} × ${measure} ${food.name.toLowerCase()}`, "normal", { foodId: food.id, measure, qty })}>Save</motion.button>
      </div>
    </>
  );
}

export function OffPlanForm({ target, onSave }: { target: NonNullable<OffPlanTarget>; onSave: (what: string, size: OffSize, food?: FoodPortion) => void }) {
  const [fromFoods, setFromFoods] = useState(false);
  const options = target.mode === "replace" ? REPLACE_OPTIONS : EXTRA_OPTIONS;
  const groups = [...new Set(options.map((o) => o.group))];
  const [what, setWhat] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [size, setSize] = useState<Exclude<OffSize, "skipped">>("normal");
  const label = typed.trim() || what;

  if (fromFoods) return <FoodPicker onSave={onSave} onBack={() => setFromFoods(false)} />;
  return (
    <>
      <div className="checkin-opts">
        <motion.button className="checkin-opt" whileTap={{ scale: 0.97 }} onClick={() => setFromFoods(true)}>
          <span className="checkin-icon"><span className="emoji">🥄</span></span>
          <span className="checkin-txt"><b>From your food list</b><span>Psyllium, nuts, a banana: every nutrient counts</span></span>
        </motion.button>
      </div>
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
