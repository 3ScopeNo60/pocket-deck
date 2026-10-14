import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { meals as contentMeals, suppers } from "../core/content";
import type { LastNight } from "../core/types";
import { PLATES, TONIGHT, type Plate, type Tonight } from "../data/meals";

/* The food grid fills the top of the screen, after the "Week 14" reference:
   a dot grid with today's possible foods sitting in some of the cells. */
const FOODS = [...new Set(contentMeals.map((m) => m.emoji))];
const CELLS = [0, 2, 4, 6, 8, 10, 13].map((cell, i) => ({ cell, icon: FOODS[i % FOODS.length] }));

export interface CheckInAnswer {
  lastNight: LastNight | null;
  tonight: Tonight;
}

/**
 * The day's first screen. It asks about last night's supper, which always has a real
 * answer, rather than guessing at tonight's; tonight is an optional heads-up. Also
 * reopened from Today's "Last night" pill to correct it, when it shows a close button.
 */
export function CheckIn({
  greeting,
  date,
  initial,
  changing,
  onDone,
  onClose,
}: {
  greeting: string;
  date: string;
  initial: CheckInAnswer | null;
  changing: boolean;
  onDone: (a: CheckInAnswer) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(initial?.lastNight?.supperId ?? null);
  const [plate, setPlate] = useState<Plate>(initial?.lastNight?.plate ?? "Normal");
  const [tonight, setTonight] = useState<Tonight | null>(initial && initial.tonight !== "normal" ? initial.tonight : null);

  /* Show the food grid only when there's room for at least two clear rows of it;
     on a phone the options fill the screen and the grid steps aside. */
  const art = useRef<HTMLDivElement>(null);
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const el = art.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRoomy(e.contentRect.height >= 170));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const done = (lastNight: LastNight | null) => onDone({ lastNight, tonight: tonight ?? "normal" });

  return (
    <motion.div
      className="checkin"
      initial={changing ? { y: "100%" } : { opacity: 0 }}
      animate={changing ? { y: 0 } : { opacity: 1 }}
      exit={{ y: "-100%", transition: { duration: 0.45, ease: [0.6, 0, 0.3, 1] } }}
      transition={{ type: "spring", stiffness: 300, damping: 34 }}
    >
      <div className="checkin-col">
        {changing && (
          <button className="icon-btn checkin-close" onClick={onClose} aria-label="Keep it as it is">
            <X size={22} strokeWidth={2} />
          </button>
        )}

        <div className="checkin-art" ref={art} aria-hidden="true">
          {roomy && <div className="food-grid">
            {Array.from({ length: 15 }, (_, i) => {
              const food = CELLS.find((c) => c.cell === i);
              return food ? (
                <motion.span
                  key={i}
                  className="food emoji"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
                  transition={{
                    opacity: { delay: 0.05 * i }, scale: { type: "spring", stiffness: 300, damping: 18, delay: 0.05 * i },
                    y: { repeat: Infinity, duration: 3.2 + (i % 3) * 0.6, ease: "easeInOut", delay: 0.4 + i * 0.1 },
                  }}
                >
                  {food.icon}
                </motion.span>
              ) : (
                <span key={i} className="food-dot" />
              );
            })}
          </div>}
        </div>

        <div className="checkin-ask">
          <div className="date">{date}</div>
          <div className="checkin-hello">{greeting}</div>
          <h2 className="checkin-q">What was supper last night?</h2>
          <p className="checkin-why">Today's meals balance it out.</p>
        </div>

        {(["Home", "Takeaway"] as const).map((g, gi) => (
          <section key={g} className="checkin-group">
            <h3 className="section-label">{g === "Home" ? "Home-cooked" : "Takeaway"}</h3>
            <div className="supper-grid compact">
              {suppers.filter((s) => s.group === g).map((s, i) => (
                <motion.button
                  key={s.id}
                  className="supper-opt"
                  aria-pressed={chosen === s.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.05 + (gi * 7 + i) * 0.025 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setChosen(s.id)}
                >
                  <span className="emoji">{s.emoji}</span>
                  <span>{s.name}</span>
                </motion.button>
              ))}
            </div>
          </section>
        ))}

        <section className="checkin-group">
          <h3 className="section-label">How big a plate?</h3>
          <div className="seg seg-3" role="group" aria-label="Plate size">
            {(Object.keys(PLATES) as Plate[]).map((p) => (
              <button key={p} aria-pressed={plate === p} onClick={() => setPlate(p)}>{p}</button>
            ))}
          </div>
        </section>

        <section className="checkin-group tonight-row">
          <h3 className="section-label">Already know tonight's? <span className="optional">Optional</span></h3>
          <div className="chips" role="group" aria-label="Tonight's supper">
            {(["light", "heavy"] as const).map((t) => (
              <motion.button
                key={t}
                className="chip"
                aria-pressed={tonight === t}
                whileTap={{ scale: 0.94 }}
                onClick={() => setTonight(tonight === t ? null : t)}
              >
                <span className="emoji">{TONIGHT[t].icon}</span> {TONIGHT[t].label}
              </motion.button>
            ))}
          </div>
        </section>

        <div className="checkin-actions">
          <button className="btn ghost" onClick={() => done(null)}>Can't remember</button>
          <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!chosen} onClick={() => chosen && done({ supperId: chosen, plate })}>
            Plan my day
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
