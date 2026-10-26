import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { SLOTS, type Meal, type SlotKey } from "../data/meals";

export type ExitKind = { kind: "swap"; dir: 1 | -1 } | { kind: "eat" };

const POSES = [
  { y: 0, scale: 1, rotate: 0 },
  { y: 14, scale: 0.95, rotate: -2.5 },
  { y: 26, scale: 0.9, rotate: 2.5 },
];

const spring = { type: "spring", stiffness: 380, damping: 30, mass: 0.9 } as const;
const flipSpring = { type: "spring", stiffness: 260, damping: 26 } as const;

const outer = {
  exit: (c: ExitKind) =>
    c.kind === "swap"
      ? { x: c.dir * 520, rotate: c.dir * 22, opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }
      : { y: 240, scale: 0.6, opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } },
};

interface BackInfo {
  daySat: number;
  allowance: number;
  ticks: number[];
  onTick: (i: number) => void;
  onNotFeelingIt: (slot: SlotKey) => void;
  /** Opens the "had something else" sheet for this slot. */
  onSomethingElse: (slot: SlotKey) => void;
  /** When each meal is eaten, as he has set it. */
  times?: Partial<Record<SlotKey, string>>;
  /** Opens the explanation of where the numbers come from. */
  onNumbers?: () => void;
  /** Opens every nutrient marker for this meal. */
  onNutrients?: (mealId: string) => void;
  /** Go without an optional ingredient today (the milk on oats), or have it again. */
  onLeftOut?: (slot: SlotKey, foodId: string) => void;
  /** For a near-miss card: put its missing ingredients on the shopping list. */
  onAddToList: (slot: SlotKey) => void;
}

interface DeckProps extends BackInfo {
  slots: SlotKey[];
  mealFor: (slot: SlotKey) => Meal;
  exit: ExitKind;
  flipped: SlotKey | null;
  onFlip: (slot: SlotKey | null) => void;
  onSwap: (slot: SlotKey, dir: 1 | -1) => boolean;
  onEat: (slot: SlotKey) => void;
  empty: React.ReactNode;
  /** Daytime is done and something else takes the space: the deck folds away. */
  collapsed?: boolean;
  /** Counts up each time the user brings a different card to the top by hand. */
  shuffle?: number;
}

export function Deck({ slots, mealFor, exit, flipped, onFlip, onSwap, onEat, empty, collapsed, shuffle = 0, ...back }: DeckProps) {
  const shown = slots.slice(0, 3);
  return (
    <div className={collapsed ? "deck deck-done" : "deck"}>
      {shown.length === 0 && empty}
      <AnimatePresence initial={false} custom={exit}>
        {shown
          .map((slot, pos) => (
            <MealCard
              key={`${slot}:${mealFor(slot).id}`}
              slot={slot}
              meal={mealFor(slot)}
              pos={pos}
              flipped={pos === 0 && flipped === slot}
              onFlip={onFlip}
              onSwap={onSwap}
              onEat={onEat}
              shuffle={shuffle}
              back={back}
            />
          ))
          .reverse()}
      </AnimatePresence>
    </div>
  );
}

interface CardProps {
  slot: SlotKey;
  meal: Meal;
  pos: number;
  flipped: boolean;
  onFlip: DeckProps["onFlip"];
  onSwap: DeckProps["onSwap"];
  onEat: DeckProps["onEat"];
  back: BackInfo;
  shuffle: number;
}

function MealCard({ slot, meal, pos, flipped, onFlip, onSwap, onEat, back, shuffle }: CardProps) {
  const s = SLOTS.find((x) => x.key === slot)!;
  const top = pos === 0;
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-240, 240], [-14, 14]);
  const controls = useDragControls();
  const dragged = useRef(false);

  /* ── brought to the top by hand ────────────────────────────
     The stack is normally ordered by the day. When the switcher
     reorders it, the card that comes up is lifted OUT of the
     stack, sent over the top and dropped in place, while the one
     it replaces settles back with a small nudge: the pair reads
     as swapped rather than as one fading into the other. It
     always leaves the same way, so the gesture is predictable. */
  const fx = useMotionValue(0);
  const fy = useMotionValue(POSES[pos].y);
  const fr = useMotionValue(POSES[pos].rotate);
  const fs = useMotionValue(POSES[pos].scale);
  const fz = useMotionValue(10 - pos);
  /* a card that has just gone behind keeps its face while the other slides clear */
  const [keepFace, setKeepFace] = useState(false);
  const seen = useRef({ pos, shuffle });
  useEffect(() => {
    const was = seen.current;
    seen.current = { pos, shuffle };
    const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (shuffle === was.shuffle || pos === was.pos || reduced) { fz.set(10 - pos); return; }
    /* always the same way out: to the left, away from the menu */
    const side = -1;
    const out = Math.min(150, (typeof window !== "undefined" ? window.innerWidth : 390) * 0.38);
    const OUT_MS = 230;
    let timer: number | undefined;
    if (pos === 0) {
      /* pulled OUT FROM UNDER the cards in front of it: it keeps its old
         place in the stack while it slides clear of them, and only then
         is it above them, and slides home across the top. */
      fz.set(10 - was.pos);
      void (async () => {
        await Promise.all([
          animate(fx, side * out, { duration: OUT_MS / 1000, ease: "easeOut" }),
          animate(fr, 7 * side, { duration: OUT_MS / 1000, ease: "easeOut" }),
        ]);
        fz.set(20);
        animate(fs, [1.04, 1], { duration: 0.42, ease: "easeOut" });
        await Promise.all([
          animate(fx, 0, { type: "spring", stiffness: 320, damping: 26 }),
          animate(fr, 0, { type: "spring", stiffness: 260, damping: 22 }),
        ]);
        fz.set(10);
      })();
    } else if (was.pos === 0) {
      /* the one that was on top stays on top until the other is clear,
         then slips behind it */
      fz.set(10);
      setKeepFace(true);
      timer = window.setTimeout(() => { fz.set(10 - pos); setKeepFace(false); }, OUT_MS + 60);
      animate(fx, [fx.get(), -18 * side, 0], { duration: 0.55, times: [0, 0.4, 1], ease: "easeOut" });
      animate(fr, [fr.get(), -3 * side, 0], { duration: 0.55, times: [0, 0.4, 1], ease: "easeOut" });
    } else {
      fz.set(10 - pos);
    }
    return () => window.clearTimeout(timer);
  }, [pos, shuffle, fx, fy, fr, fs, fz]);

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    const far = Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 600;
    const dir = (info.offset.x + info.velocity.x * 0.1 > 0 ? 1 : -1) as 1 | -1;
    if (!far || !onSwap(slot, dir)) animate(x, 0, spring);
  }

  return (
    <motion.div
      className="card"
      data-slot={slot}
      variants={outer}
      initial={{ y: 30, scale: 0.88, opacity: 0 }}
      animate={{ ...POSES[pos], opacity: 1 }}
      exit="exit"
      transition={spring}
      style={{ zIndex: fz, x: fx, y: fy, rotate: fr, scale: fs }}
      aria-hidden={!top}
    >
      <motion.div
        className="grip"
        drag={top && !flipped ? "x" : false}
        dragListener={false}
        dragControls={controls}
        dragElastic={0.9}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={handleDragEnd}
        onPointerDown={(e) => {
          dragged.current = false;
          if (top && !flipped && !(e.target as HTMLElement).closest("button")) controls.start(e);
        }}
        onClick={(e) => {
          if (!top || dragged.current || (e.target as HTMLElement).closest("button")) return;
          onFlip(flipped ? null : slot);
        }}
        style={{ x, rotate: tilt }}
      >
        <motion.div className="flipper" initial={false} animate={{ rotateY: flipped ? 180 : 0 }} transition={flipSpring}>
          {/* Front: what to eat */}
          <div className="face front">
            <div className="pad">
              <div className="slot">
                <span className="slot-name">{s.label}</span>
                <span className="pill">{back.times?.[slot] ?? s.when}</span>
              </div>
              <div className={top || keepFace ? "card-body" : "card-body hidden-behind"}>
                <div className="title">
                  <div className="icon-tile"><span className="emoji">{meal.icon}</span></div>
                  <h2 className="name">{meal.name}</h2>
                </div>
                <div className="tags">
                  {meal.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <ul className="items">
                  {meal.items.map(([e, w, q]) => {
                    const opt = meal.optional?.find((o) => o.name === w);
                    return (
                      <li key={w} className={meal.missing?.includes(w) ? "item need" : opt?.left ? "item left" : "item"}>
                        <span className="emoji">{e}</span>
                        <span className="what">{w}{opt && <small className="opt-tag"> optional</small>}</span>
                        {opt ? (
                          <button className="pill opt" aria-pressed={opt.left} aria-label={opt.left ? `Have ${w} again` : `Go without ${w}`} onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); back.onLeftOut?.(slot, opt.foodId); }}>
                            {opt.left ? "Water instead" : `${q} · tap to skip`}
                          </button>
                        ) : (
                          q && <span className="pill">{q}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="actions">
                  <span className="hint">{meal.missing?.length ? `Need ${meal.missing.length} of ${meal.items.length} · closest fit` : "Swipe to swap · tap for steps"}</span>
                  {meal.missing?.length ? (
                    <motion.button className="btn" whileTap={{ scale: 0.92 }} onClick={() => back.onAddToList(slot)} tabIndex={top && !flipped ? 0 : -1}>
                      Add to list
                    </motion.button>
                  ) : (
                    <motion.button className="btn" whileTap={{ scale: 0.92 }} onClick={() => onEat(slot)} tabIndex={top && !flipped ? 0 : -1}>
                      Eaten
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Back: how to make it, how to make it tastier, the numbers */}
          {top && (
            <div className="face back" aria-hidden={!flipped}>
              <div className="pad scroll">
                <div className="slot">
                  <span className="slot-name">{s.label} · how to</span>
                  <span className="pill">{back.times?.[slot] ?? s.when}</span>
                </div>
                <h3 className="back-title">{meal.name}</h3>
                <ul className="steps">
                  {meal.steps.map((t, i) => (
                    <li key={t}>
                      <button className="step" aria-pressed={back.ticks.includes(i)} onClick={() => back.onTick(i)} tabIndex={flipped ? 0 : -1}>
                        <motion.span className="box" animate={{ scale: back.ticks.includes(i) ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.3 }} />
                        <span className="txt">{t}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <h4 className="section-label">Make it tastier</h4>
                <ul className="boosters">
                  {meal.boosters.map((b) => <li key={b} className="booster"><span className="emoji">✨</span>{b}</li>)}
                </ul>
                <h4 className="section-label">The numbers</h4>
                <dl className="nums">
                  <div><dt>Sat fat</dt><dd>≈ {meal.sat.toFixed(1)} g</dd></div>
                  <div><dt>Sol. fibre</dt><dd>≈ {meal.sol.toFixed(1)} g</dd></div>
                  <div><dt>Sodium</dt><dd>≈ {Math.round(meal.na / 10) * 10} mg</dd></div>
                  <div><dt>Energy</dt><dd>≈ {Math.round(meal.kcal / 5) * 5} kcal</dd></div>
                  <div><dt>Cost</dt><dd>≈ R{meal.cost}</dd></div>
                  <div><dt>Day so far</dt><dd>≈ {back.daySat.toFixed(1)}/{back.allowance} g</dd></div>
                </dl>
                <p className="rough">Estimates from a food database and typical portions: close, not exact. <button className="link" onClick={() => back.onNumbers?.()} tabIndex={flipped ? 0 : -1}>How they're worked out</button></p>
                <button className="btn ghost small all-nutrients" onClick={() => back.onNutrients?.(meal.id)} tabIndex={flipped ? 0 : -1}>All nutrients</button>
                <div className="actions back-actions">
                  <button className="btn ghost" onClick={() => back.onNotFeelingIt(slot)} tabIndex={flipped ? 0 : -1}>Not feeling it</button>
                  <button className="btn ghost" onClick={() => back.onSomethingElse(slot)} tabIndex={flipped ? 0 : -1}>Had something else</button>
                  {!meal.missing?.length && (
                    <motion.button className="btn" whileTap={{ scale: 0.92 }} onClick={() => onEat(slot)} tabIndex={flipped ? 0 : -1}>Eaten</motion.button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
