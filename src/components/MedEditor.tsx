import { useState } from "react";
import { motion } from "motion/react";
import type { Med } from "../core/types";
import { Sheet } from "./Sheets";
import { TimeWheel, mergeTime } from "./TimeWheel";

const DEFAULT_TIMES: Record<number, string[]> = { 1: ["20:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"] };

/** Add, change or remove the medication: what it is, how often, and how many tablets are left. */
export function MedSheet({ open, med, onClose, onSave, onRemove }: { open: boolean; med: Med | null; onClose: () => void; onSave: (m: Med) => void; onRemove: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={med ? "Your medication" : "Add your medication"}>
      {open && <Form med={med} onSave={onSave} onRemove={onRemove} />}
    </Sheet>
  );
}

function Form({ med, onSave, onRemove }: { med: Med | null; onSave: (m: Med) => void; onRemove: () => void }) {
  const initialTimes = med?.times?.length ? med.times : med?.time ? [med.time] : DEFAULT_TIMES[1];
  const [name, setName] = useState(med?.name ?? "");
  const [dose, setDose] = useState(med?.dose ?? "");
  const [per, setPer] = useState(med?.perDose ?? 1);
  const [times, setTimes] = useState<string[]>(initialTimes);
  const [at, setAt] = useState(0);
  const [pack, setPack] = useState(med?.packSize ? String(med.packSize) : "");
  const [left, setLeft] = useState(med ? String(med.pillsLeft) : "");

  const n = times.length;
  const setCount = (c: number) => { setTimes(DEFAULT_TIMES[c]); setAt(0); };
  const ready = name.trim().length > 0;

  const save = () => {
    const sorted = [...times].sort();
    const packSize = Number(pack) || 0;
    onSave({
      id: med?.id ?? "med-1", name: name.trim(), dose: dose.trim(), time: sorted[0], times: sorted, perDose: per,
      packSize, pillsLeft: left.trim() === "" ? packSize : Number(left) || 0, takenLog: med?.takenLog ?? [],
    });
  };

  return (
    <>
      <label className="me-field"><span className="me-label">Name</span><span className="me-input"><input value={name} placeholder="As printed on the box" aria-label="Medication name" onChange={(e) => setName(e.target.value)} /></span></label>
      <div className="me-grid two">
        <label className="me-field"><span className="me-label">Strength</span><span className="me-input"><input value={dose} placeholder="20 mg" aria-label="Medication strength" onChange={(e) => setDose(e.target.value)} /></span></label>
        <div className="me-field">
          <span className="me-label">Tablets each time</span>
          <div className="stepper wide" role="group" aria-label="Tablets each time">
            <button aria-label="One fewer tablet" onClick={() => setPer((v) => Math.max(1, v - 1))}>−</button>
            <b>{per}</b>
            <button aria-label="One more tablet" onClick={() => setPer((v) => Math.min(4, v + 1))}>+</button>
          </div>
        </div>
      </div>

      <div className="me-field">
        <span className="me-label">Times a day</span>
        <div className="seg seg-3" role="group" aria-label="Times a day">
          {[1, 2, 3].map((c) => (<button key={c} aria-pressed={n === c} onClick={() => setCount(c)}>{c === 1 ? "Once" : c === 2 ? "Twice" : "Three"}</button>))}
        </div>
      </div>

      <div className="me-field">
        {n > 1 ? (
          <div className="chips" role="group" aria-label="Which dose">
            {times.map((t, i) => (<button key={i} className="chip" aria-pressed={at === i} onClick={() => setAt(i)}>{["First", "Second", "Third"][i]} · {t}</button>))}
          </div>
        ) : (
          <span className="me-label">Time you take it · {times[0]}</span>
        )}
        <TimeWheel key={at} value={times[at]} onChange={(part) => setTimes((ts) => ts.map((t, i) => (i === at ? mergeTime(t, part) : t)))} />
      </div>

      <div className="me-grid two">
        <label className="me-field"><span className="me-label">Tablets in a pack <span className="optional">Optional</span></span><span className="me-input"><input inputMode="numeric" value={pack} placeholder="30" aria-label="Tablets in a pack" onChange={(e) => setPack(e.target.value.replace(/\D/g, ""))} /></span></label>
        <label className="me-field"><span className="me-label">Tablets left <span className="optional">Optional</span></span><span className="me-input"><input inputMode="numeric" value={left} placeholder={pack || "0"} aria-label="Tablets left" onChange={(e) => setLeft(e.target.value.replace(/\D/g, ""))} /></span></label>
      </div>
      {med && Number(pack) > 0 && (
        <button className="btn small ghost" onClick={() => setLeft(String((Number(left) || 0) + Number(pack)))}>Started a new pack: add {pack}</button>
      )}
      <p className="k-sub">Tablets left counts down as you tick each dose, and the bell tells you a week before they run out.</p>

      <div className="sheet-actions">
        {med && <button className="btn ghost" onClick={onRemove}>Remove</button>}
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!ready} onClick={save}>{ready ? "Save" : "Enter the name"}</motion.button>
      </div>
    </>
  );
}
