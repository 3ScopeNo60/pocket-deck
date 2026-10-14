import { useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";

export type Dir = "left" | "right" | "up";

export interface SwipeAction {
  dir: Dir;
  /** Spoken label and button caption. */
  label: string;
  emoji: string;
  /** Word stamped on the card while dragging that way. */
  stamp: string;
}

interface Props {
  /** Changes with each card, so a new card starts fresh. */
  id: string;
  actions: SwipeAction[];
  onDecide: (d: Dir) => void;
  /** Go back one card. Shown as a small button; disabled when there's no previous card. */
  onPrevious?: () => void;
  canPrevious?: boolean;
  children: ReactNode;
}

const OFFSCREEN: Record<Dir, { x: number; y: number }> = { left: { x: -760, y: 40 }, right: { x: 760, y: 40 }, up: { x: 0, y: -900 } };

/**
 * A card you throw: right, left, or (if offered) up. The buttons underneath do exactly the
 * same thing, for thumbs that would rather tap. One decision per card; both paths animate out.
 */
export function SwipeStack({ id, actions, onDecide, onPrevious, canPrevious, children }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-11, 11]);
  const has = (d: Dir) => actions.some((a) => a.dir === d);
  const stampOpacity: Record<Dir, ReturnType<typeof useTransform<number, number>>> = {
    right: useTransform(x, [30, 130], [0, 1]),
    left: useTransform(x, [-130, -30], [1, 0]),
    up: useTransform(y, [-130, -30], [1, 0]),
  };
  const busy = useRef(false);

  async function decide(d: Dir) {
    if (busy.current || !has(d)) return;
    busy.current = true;
    const to = OFFSCREEN[d];
    await Promise.all([animate(x, to.x, { duration: 0.26, ease: "easeIn" }), animate(y, to.y, { duration: 0.26, ease: "easeIn" })]);
    onDecide(d);
    // The next card mounts with these same motion values: bring them home, or it starts off-screen.
    x.set(0);
    y.set(0);
    busy.current = false;
  }

  function release(_: PointerEvent, info: PanInfo) {
    const { x: ox, y: oy } = info.offset;
    const vx = info.velocity.x;
    if (has("right") && (ox > 110 || vx > 600)) return void decide("right");
    if (has("left") && (ox < -110 || vx < -600)) return void decide("left");
    if (has("up") && oy < -110 && Math.abs(oy) > Math.abs(ox)) return void decide("up");
    animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 420, damping: 30 });
  }

  return (
    <div className="swipe">
      <div className="swipe-area">
        <motion.div
          key={id}
          className="swipe-card"
          drag
          dragElastic={0.85}
          dragMomentum={false}
          style={{ x, y, rotate, touchAction: "none" }}
          onDragEnd={release}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          {children}
          {actions.map((a) => (
            <motion.span key={a.dir} aria-hidden="true" className={`stamp stamp-${a.dir}`} style={{ opacity: stampOpacity[a.dir] }}>{a.stamp}</motion.span>
          ))}
        </motion.div>
      </div>

      <div className="swipe-buttons" role="group" aria-label="Your answer">
        {onPrevious && (
          <button className="swipe-btn swipe-prev" aria-label="Previous" disabled={!canPrevious} onClick={onPrevious}>
            <span className="swipe-emoji">↶</span>
            <span className="swipe-caption">Previous</span>
          </button>
        )}
        {actions.map((a) => (
          <button key={a.dir} className={`swipe-btn swipe-${a.dir}`} aria-label={a.label} onClick={() => void decide(a.dir)}>
            <span className="swipe-emoji">{a.emoji}</span>
            <span className="swipe-caption">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
