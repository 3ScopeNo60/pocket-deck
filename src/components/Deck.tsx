import { useEffect, useRef } from "react";
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
     as swapped rather than as one fading into the other. The
     sideways direction alternates so repeated switching riffles
     instead of always going the same way. */
  const fx = useMotionValue(0);
  const fy = useMotionValue(POSES[pos].y);
  const fr = useMotionValue(POSES[pos].rotate);
  const fs = useMotionValue(POSES[pos].scale);
  const seen = useRef({ pos, shuffle });
  useEffect(() => {
    const was = seen.current;
    seen.current = { pos, shuffle };
    if (shuffle === was.shuffle || pos === was.pos) return;
    const side = shuffle % 2 === 0 ? 1 : -1;
    const lift = { duration: 0.56, times: [0, 0.42, 1], ease: ["easeOut", "easeInOut"] as ("easeOut" | "easeInOut")[] };
    if (pos === 0) {
      animate(fx, [fx.get(), 62 * side, 0], lift);
      animate(fy, [fy.get(), -38, 0], lift);
      animate(fr, [fr.get(), 7 * side, 0], lift);
      animate(fs, [fs.get(), 1.05, 1], lift);
    } else if (was.pos === 0) {
      const nudge = { duration: 0.5, times: [0, 0.4, 1], ease: "easeOut" as const };
      animate(fx, [fx.get(), -26 * side, 0], nudge);
      animate(fr, [fr.get(), -4 * side, 0], nudge);
    }
  }, [pos, shuffle, fx, fy, fr, fs]);

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
      style={{ zIndex: 10 - pos, x: fx, y: fy, rotate: fr, scale: fs }}
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
                <span className="pill">{s.when}</span>
              </div>
              <div className={top ? "card-body" : "card-body hidden-behind"}>
                <div className="title">
                  <div className="icon-tile"><span className="emoji">{meal.icon}</span></div>
                  <h2 className="name">{meal.name}</h2>
                </div>
                <div className="tags">
                  {meal.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <ul className="items">
                  {meal.items.map(([e, w, q]) => (
                    <li key={w} className={meal.missing?.includes(w) ? "item need" : "item"}>
                      <span className="emoji">{e}</span>
                      <span className="what">{w}</span>
                      {q && <span className="pill">{q}</span>}
                    </li>
                  ))}
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
                  <span className="pill">{s.when}</span>
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
                  <div><dt>Sat fat</dt><dd>{meal.sat.toFixed(1)} g</dd></div>
                  <div><dt>Sol. fibre</dt><dd>{meal.sol.toFixed(1)} g</dd></div>
                  <div><dt>Sodium</dt><dd>{meal.na} mg</dd></div>
                  <div><dt>Energy</dt><dd>{meal.kcal} kcal</dd></div>
                  <div><dt>Cost</dt><dd>R{meal.cost}</dd></div>
                  <div><dt>Day so far</dt><dd>{back.daySat.toFixed(1)}/{back.allowance} g</dd></div>
                </dl>
                <p className="rough">Rough figures for the prototype. Real values come from the food database.</p>
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
