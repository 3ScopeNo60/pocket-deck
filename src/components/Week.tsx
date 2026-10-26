import { motion } from "motion/react";
import { toast } from "sonner";
import { meals } from "../core/content";
import { prepLines, type WeekPlan } from "../core/week";
import { SLOTS, TONIGHT, type SlotKey, type Tonight } from "../data/meals";
import { mealMap } from "../app/viewModel";

interface Props {
  week: WeekPlan | null;
  summary: { needs: { foodId: string; needG: number }[]; cost: number } | null;
  onPlan: () => void;
  onTag: (date: string, t: Tonight) => void;
  onSwap: (date: string, slot: SlotKey, dir: 1 | -1) => boolean;
  onToList: () => number;
  onOpenList: () => void;
  listCount: number;
  /** Open a meal's ingredients and steps. */
  onOpenMeal: (mealId: string) => void;
}

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
const short = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
const TAGS: Tonight[] = ["light", "normal", "heavy"];

/** The coming week: tag the evenings you know about, see what you'd eat, and what to buy. */
export function WeekScreen({ week, summary, onPlan, onTag, onSwap, onToList, onOpenList, listCount, onOpenMeal }: Props) {
  if (!week || !summary) {
    return (
      <div className="kitchen">
        <header><h1 className="hello">Week</h1></header>
        <section className="k-section">
          <p className="k-empty">Plan the next seven days in one go. You'll see what you'd eat each day, what to buy, and what's worth cooking ahead.</p>
          <motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={onPlan}>Plan the week</motion.button>
        </section>
      </div>
    );
  }
  const dates = Object.keys(week).sort();
  const prep = prepLines(week, meals);
  const things = summary.needs.length;
  return (
    <div className="kitchen">
      <header><h1 className="hello">Week</h1></header>

      <section className="week-summary">
        <div>
          <b>{things ? `${things} ${things === 1 ? "thing" : "things"} to buy` : "Everything's in the kitchen"}</b>
          <span>{summary.cost > 0 ? `About R${summary.cost.toLocaleString("en-ZA")} of meals` : "No prices yet"}</span>
        </div>
        <div className="week-actions">
          <button className="btn ghost small" onClick={onPlan}>Re-plan</button>
          {things > 0 && (
            <motion.button
              className="btn small"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                const n = onToList();
                toast(n ? `Put ${n} ${n === 1 ? "thing" : "things"} on your list` : "It's all on your list already");
                onOpenList();
              }}
            >
              {listCount ? "Update my list" : "Put it on my list"}
            </motion.button>
          )}
        </div>
      </section>

      <p className="k-sub">Know what's for supper on any night? Tag it and that day's meals adjust.</p>

      {dates.map((d) => {
        const w = week[d];
        return (
          <article key={d} className={w.pinned ? "day-card pinned" : "day-card"}>
            <div className="day-head">
              <h3>{day(d)}</h3>
              <div className="seg seg-3 mini" role="group" aria-label={`Supper on ${short(d)}`}>
                {TAGS.map((t) => (
                  <button key={t} aria-pressed={w.tonight === t} onClick={() => onTag(d, t)}>{TONIGHT[t].label}</button>
                ))}
              </div>
            </div>
            {SLOTS.map((s) => {
              const m = w.plan[s.key] ? mealMap.get(w.plan[s.key]!) : null;
              return (
                <div key={s.key} className="krow static day-meal">
                  {m ? (
                    <button className="meal-open" aria-label={`${m.name}: ingredients and how to make it`} onClick={() => onOpenMeal(m.id)}>
                      <span className="emoji">{m.emoji}</span>
                      <span className="kname">{m.name}<small>{s.label}</small></span>
                    </button>
                  ) : (
                    <>
                      <span className="emoji">—</span>
                      <span className="kname">Nothing fits yet<small>{s.label}</small></span>
                    </>
                  )}
                  <button className="link" aria-label={`Another ${s.label.toLowerCase()} for ${short(d)}`} onClick={() => { if (!onSwap(d, s.key, 1)) toast("That's the only one that fits"); }}>Swap</button>
                </div>
              );
            })}
          </article>
        );
      })}

      {prep.length > 0 && (
        <section className="k-section">
          <h3 className="section-label">Cook ahead</h3>
          {prep.map((p) => (
            <div key={p.mealId} className="krow static">
              <button className="meal-open" aria-label={`${p.name}: ingredients and how to make it`} onClick={() => onOpenMeal(p.mealId)}>
                <span className="emoji">{p.emoji}</span>
                <span className="kname">
                  {p.name}
                  <small>
                    {p.dates.map(short).join(", ")} · keeps {p.keepsDays} {p.keepsDays === 1 ? "day" : "days"}
                    {p.splits ? " · cook it twice" : ""}
                  </small>
                </span>
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
