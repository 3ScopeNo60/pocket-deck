import { useMemo, useState } from "react";
import { meals as allMeals } from "../core/content";
import { SLOTS, slotWords, type BackSlot } from "../core/backfill";
import { mealNutrition } from "../core/nutrition";
import { SIZE_LABEL, type OffSize } from "../core/offplan";
import type { Day, LastNight, Med } from "../core/types";
import { foodMap, mealMap, supperMap } from "../app/viewModel";
import { Sheet } from "./Sheets";
import { OffPlanForm } from "./OffPlan";
import { SupperForm } from "./Tomorrow";

export interface BackLogActions {
  logMealOn: (d: string, slot: BackSlot, mealId: string) => Promise<void>;
  logElseOn: (d: string, slot: BackSlot, what: string, size: string) => Promise<void>;
  unlogOn: (d: string, slot: BackSlot) => Promise<void>;
  addExtraOn: (d: string, kind: string, size: string) => Promise<void>;
  removeExtraOn: (d: string, index: number) => Promise<void>;
  setWalkOn: (d: string, walked: boolean) => Promise<void>;
  setDosesOn: (d: string, count: number) => Promise<void>;
  setSupperOn: (d: string, s: LastNight | null) => Promise<void>;
}

const SLOT_LABEL: Record<BackSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack" };
const SLOT_EMOJI: Record<BackSlot, string> = { breakfast: "🌅", lunch: "🥗", snack: "🍎" };

export const dayWords = (date: string, today: string) => {
  const y = new Date(today + "T12:00:00");
  y.setDate(y.getDate() - 1);
  return date === y.toLocaleDateString("en-CA") ? "yesterday" : new Date(date + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "long" });
};
const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

type View = null | { kind: "meal"; slot: BackSlot } | { kind: "else"; slot: BackSlot } | { kind: "extra" } | { kind: "supper" };

/** Fill in a day that has passed: what was eaten at each meal, supper, the tablet, a walk, extras. */
export function BackLogSheet({ date, today, day, supper, med, actions, onClose }: {
  date: string | null; today: string; day: Day | undefined; supper: LastNight | null; med: Med | null; actions: BackLogActions; onClose: () => void;
}) {
  const [view, setView] = useState<View>(null);
  const title =
    !date ? "" :
    view?.kind === "meal" ? `What did you have for ${SLOT_LABEL[view.slot].toLowerCase()}?` :
    view?.kind === "else" ? `What did you have for ${SLOT_LABEL[view.slot].toLowerCase()}?` :
    view?.kind === "extra" ? "What was the extra?" :
    view?.kind === "supper" ? "What was supper?" : `Fill in ${dayWords(date, today)}`;
  return (
    <Sheet open={!!date} onOpenChange={(o) => { if (!o) { setView(null); onClose(); } }} title={title}>
      {date && (
        <div key={view ? view.kind + ("slot" in view ? view.slot : "") : "home"}>
          {view === null && <Home date={date} day={day} supper={supper} med={med} actions={actions} setView={setView} />}
          {view?.kind === "meal" && <MealPicker slot={view.slot} planned={day?.plan[view.slot] ?? null} onBack={() => setView(null)} onPick={(id) => { void actions.logMealOn(date, view.slot, id); setView(null); }} />}
          {view?.kind === "else" && (
            <>
              <OffPlanForm target={{ mode: "replace", slot: view.slot, slotLabel: SLOT_LABEL[view.slot] }} onSave={(what, size) => { void actions.logElseOn(date, view.slot, what, size); setView(null); }} />
              <div className="sheet-actions"><button className="btn ghost" onClick={() => setView(null)}>Back</button></div>
            </>
          )}
          {view?.kind === "extra" && (
            <>
              <OffPlanForm target={{ mode: "extra" }} onSave={(what, size) => { void actions.addExtraOn(date, what, size); setView(null); }} />
              <div className="sheet-actions"><button className="btn ghost" onClick={() => setView(null)}>Back</button></div>
            </>
          )}
          {view?.kind === "supper" && (
            <>
              <SupperForm current={supper} onSave={(s) => { void actions.setSupperOn(date, s); setView(null); }} onClear={() => { void actions.setSupperOn(date, null); setView(null); }} />
              <div className="sheet-actions"><button className="btn ghost" onClick={() => setView(null)}>Back</button></div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Home({ date, day, supper, med, actions, setView }: {
  date: string; day: Day | undefined; supper: LastNight | null; med: Med | null; actions: BackLogActions; setView: (v: View) => void;
}) {
  const eaten = (s: BackSlot) => day?.eaten.find((e) => e.slot === s);
  const swapped = (s: BackSlot) => (day?.replaced ?? []).find((r) => r.slot === s);
  const open = SLOTS.filter((s) => !eaten(s) && !swapped(s));
  const doses = med?.times?.length ?? (med ? 1 : 0);
  const taken = day?.dosesTaken?.length ?? (day?.tabletAt ? 1 : 0);
  const s = supper ? supperMap.get(supper.supperId) : null;
  return (
    <>
      <p className="k-sub">
        {longDate(date)}. Tick off what you had. {open.length > 0 ? `${slotWords(open)} ${open.length === 1 ? "isn't" : "aren't"} recorded yet.` : "Every meal is recorded."}
      </p>
      {SLOTS.map((slot) => {
        const e = eaten(slot);
        const r = swapped(slot);
        const meal = e ? mealMap.get(e.mealId) : null;
        const planned = day?.plan[slot] ? mealMap.get(day.plan[slot]!) : null;
        return (
          <section key={slot} className="back-slot" data-done={!!(e || r)}>
            <div className="back-head">
              <span className="emoji">{SLOT_EMOJI[slot]}</span>
              <b>{SLOT_LABEL[slot]}</b>
              {(e || r) && <button className="link" onClick={() => void actions.unlogOn(date, slot)}>Undo</button>}
            </div>
            {e && <div className="back-what"><span className="emoji">{meal?.emoji}</span>{meal?.name ?? "A meal"}</div>}
            {r && <div className="back-what"><span className="emoji">{r.size === "skipped" ? "⏭️" : "🍽️"}</span>{r.size === "skipped" ? "Skipped" : `${r.what}${r.size in SIZE_LABEL ? ` · ${SIZE_LABEL[r.size as Exclude<OffSize, "skipped">].toLowerCase()}` : ""}`}</div>}
            {!e && !r && (
              <>
                {planned && <div className="back-what muted">Planned: {planned.emoji} {planned.name}</div>}
                <div className="back-chips">
                  {planned && <button className="chip primary" onClick={() => void actions.logMealOn(date, slot, planned.id)}>Had it</button>}
                  <button className="chip" onClick={() => setView({ kind: "meal", slot })}>{planned ? "A different meal" : "Pick a meal"}</button>
                  <button className="chip" onClick={() => setView({ kind: "else", slot })}>Something else</button>
                  <button className="chip" onClick={() => void actions.logElseOn(date, slot, "Skipped", "skipped")}>Skipped</button>
                </div>
              </>
            )}
          </section>
        );
      })}

      <section className="back-slot">
        <div className="back-head"><span className="emoji">🌙</span><b>Supper</b><button className="link" onClick={() => setView({ kind: "supper" })}>{s ? "Change" : "Set"}</button></div>
        <div className={s ? "back-what" : "back-what muted"}>{s ? `${s.emoji} ${s.name} · ${supper!.plate.toLowerCase()} plate` : "Not recorded, so a normal supper is assumed"}</div>
      </section>

      <section className="back-slot">
        <div className="back-head"><span className="emoji">💊</span><b>Habits</b></div>
        {doses > 0 && (
          <div className="back-line">
            <span>Tablet · {taken} of {doses}</span>
            <div className="stepper" role="group" aria-label="Tablet doses taken">
              <button aria-label="One fewer" onClick={() => void actions.setDosesOn(date, taken - 1)}>−</button>
              <b>{taken}</b>
              <button aria-label="One more" onClick={() => void actions.setDosesOn(date, taken + 1)}>+</button>
            </div>
          </div>
        )}
        <button className="switch-row" role="switch" aria-checked={!!day?.walk} onClick={() => void actions.setWalkOn(date, !day?.walk)}>
          <span className="kname">Walked or moved</span>
          <span className="switch" aria-hidden><span className="switch-knob" /></span>
        </button>
      </section>

      <section className="back-slot">
        <div className="back-head"><span className="emoji">➕</span><b>Extras</b><button className="link" onClick={() => setView({ kind: "extra" })}>Add</button></div>
        {(day?.extras ?? []).length === 0 && <div className="back-what muted">Nothing extra</div>}
        {(day?.extras ?? []).map((x, i) => (
          <div key={i} className="back-line"><span>{x.kind}{x.size in SIZE_LABEL ? ` · ${SIZE_LABEL[x.size as Exclude<OffSize, "skipped">].toLowerCase()}` : ""}</span><button className="link" aria-label={`Remove ${x.kind}`} onClick={() => void actions.removeExtraOn(date, i)}>Remove</button></div>
        ))}
      </section>
      <p className="k-sub">Meals you pick come out of the pantry, and the day's score and the week's numbers update.</p>
    </>
  );
}

function MealPicker({ slot, planned, onBack, onPick }: { slot: BackSlot; planned: string | null; onBack: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return allMeals
      .filter((m) => m.slot === slot && (!t || m.name.toLowerCase().includes(t)))
      .sort((a, b) => (a.id === planned ? -1 : b.id === planned ? 1 : a.name.localeCompare(b.name)));
  }, [q, slot, planned]);
  return (
    <>
      <input className="search" placeholder="Search meals" aria-label="Search meals" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {list.map((m) => (
          <button key={m.id} className="krow" onClick={() => onPick(m.id)}>
            <span className="emoji">{m.emoji}</span>
            <span className="kname">{m.name}<small>{m.id === planned ? "Was planned · " : ""}about {mealNutrition(m, foodMap).sat.toFixed(1)} g saturated fat</small></span>
          </button>
        ))}
        {list.length === 0 && <p className="k-empty">No {SLOT_LABEL[slot].toLowerCase()} meals match.</p>}
      </div>
      <div className="sheet-actions"><button className="btn ghost" onClick={onBack}>Back</button></div>
    </>
  );
}
