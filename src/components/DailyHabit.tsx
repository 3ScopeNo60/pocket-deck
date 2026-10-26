import { useState } from "react";
import { portionOn, portionWords, psylliumHabit } from "../core/daily";
import type { DailyItem } from "../core/types";
import { foodMap } from "../app/viewModel";
import { Segmented } from "./Segmented";

const QTY = [1, 2, 3, 6];
const qtyOptions = QTY.map((q) => ({ value: String(q), label: portionWords("1 tsp", q) }));

/** Psyllium husk every day: a teaspoon for a while, then a tablespoon. It's ticked on Today and counts in full. */
export function DailyHabit({ items, today, onSave }: { items: DailyItem[]; today: string; onSave: (items: DailyItem[]) => void }) {
  const mine = items.find((i) => i.foodId === "psyllium");
  const [on, setOn] = useState(!!mine);
  const [start, setStart] = useState(mine?.startDate ?? today);
  const [firstDays, setFirstDays] = useState(mine?.phases[0]?.days ?? 14);
  const [firstQty, setFirstQty] = useState(mine?.phases[0]?.qty ?? 1);
  const [thenQty, setThenQty] = useState(mine?.phases[1]?.qty ?? 3);
  const rest = items.filter((i) => i.foodId !== "psyllium");
  const build = (o: { on: boolean; start: string; firstDays: number; firstQty: number; thenQty: number }): DailyItem[] => {
    if (!o.on) return rest;
    const h = psylliumHabit(o.start, o.firstDays);
    h.phases = [{ days: o.firstDays, qty: o.firstQty }, { days: null, qty: o.thenQty }];
    return [...rest, h];
  };
  const commit = (patch: Partial<{ on: boolean; start: string; firstDays: number; firstQty: number; thenQty: number }>) => {
    const o = { on, start, firstDays, firstQty, thenQty, ...patch };
    if (patch.on !== undefined) setOn(patch.on);
    if (patch.start !== undefined) setStart(patch.start);
    if (patch.firstDays !== undefined) setFirstDays(patch.firstDays);
    if (patch.firstQty !== undefined) setFirstQty(patch.firstQty);
    if (patch.thenQty !== undefined) setThenQty(patch.thenQty);
    onSave(build(o));
  };
  const psy = foodMap.get("psyllium");
  const tsp = psy?.measures["1 tsp"];
  const todays = mine ? portionOn(mine, today) : null;
  return (
    <section className="k-section">
      <button className="switch-row" role="switch" aria-checked={on} onClick={() => commit({ on: !on })}>
        <span className="kname">Take psyllium husk every day<small>A tick on Today. It counts toward your soluble fibre and comes out of the pantry.</small></span>
        <span className="switch" aria-hidden><span className="switch-knob" /></span>
      </button>
      {on && (
        <>
          <h3 className="section-label">First</h3>
          <Segmented label="First amount" value={String(firstQty)} options={qtyOptions} onChange={(v) => commit({ firstQty: Number(v) })} />
          <div className="own-row">
            <span className="kname">for<small>{firstDays} days, starting {new Date(start + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}</small></span>
            <div className="stepper" role="group" aria-label="Days at the first amount">
              <button aria-label="One fewer day" onClick={() => commit({ firstDays: Math.max(1, firstDays - 1) })}>−</button>
              <b>{firstDays}</b>
              <button aria-label="One more day" onClick={() => commit({ firstDays: firstDays + 1 })}>+</button>
            </div>
          </div>
          <label className="me-field">
            <span className="me-label">Starting on</span>
            <span className="me-input"><input type="date" value={start} aria-label="Start date" onChange={(e) => e.target.value && commit({ start: e.target.value })} /></span>
          </label>
          <h3 className="section-label">Then</h3>
          <Segmented label="Amount after that" value={String(thenQty)} options={qtyOptions} onChange={(v) => commit({ thenQty: Number(v) })} />
          {todays && <p className="k-sub" role="status">Today: <b>{todays.words}</b>{todays.daysLeft !== null ? ` (day ${todays.dayNo}, ${todays.daysLeft} ${todays.daysLeft === 1 ? "day" : "days"} to go before ${portionWords("1 tsp", thenQty)})` : ` every day from here on`}.</p>}
          {!todays && <p className="k-sub" role="status">It starts on {new Date(start + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}.</p>}
          <p className="k-sub">A tablespoon counts as three teaspoons of whatever a teaspoon weighs{tsp ? ` (now ${tsp} g)` : ""}. Scan the label under Pantry › Scan a label so a teaspoon weighs what your pack says.</p>
          <p className="k-sub">While this is on, the "Psyllium in water" snack is set aside, so the plan's snack is something else.</p>
        </>
      )}
    </section>
  );
}
