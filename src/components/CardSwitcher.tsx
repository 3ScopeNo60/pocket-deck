import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface SwitchItem {
  slot: string;
  label: string;
  emoji: string;
  name: string;
  sat?: number;
  nearMiss?: boolean;
}

export type SwitcherMode = "off" | "dots" | "peek";

/**
 * Lets you see what's coming without finishing what's in front: the cards stay a stack, and
 * this brings whichever one you want to the top.
 *
 *   dots — a dot per uneaten meal. Touch one to bring that card up; keep your thumb down and
 *          slide across them to riffle through the stack.
 *   peek — one tap brings the next card up. Hold and a small list opens above your thumb with
 *          every meal named, so you can read what's for lunch and the snack without moving
 *          anything; slide up to one and let go.
 */
export function CardSwitcher({ items, active, mode, onPick }: { items: SwitchItem[]; active: string; mode: SwitcherMode; onPick: (slot: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const live = useRef(false);
  const [peek, setPeek] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const peekRows = useRef(new Map<string, HTMLElement>());
  const moved = useRef(false);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);
  if (mode === "off" || items.length < 2) return null;

  /** Which dot the pointer is nearest, by the dots' own centres (they sit bunched in the middle of a wide row). */
  const dotAt = (x: number) => {
    const els = row.current?.querySelectorAll<HTMLElement>(".switch-dot");
    if (!els || !els.length) return items[0].slot;
    let best = 0;
    let gap = Infinity;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(x - (r.left + r.width / 2));
      if (d < gap) { gap = d; best = i; }
    });
    return items[best].slot;
  };
  const peekAt = (y: number): string | null => {
    for (const [slot, el] of peekRows.current) {
      const r = el.getBoundingClientRect();
      if (y >= r.top - 6 && y <= r.bottom + 6) return slot;
    }
    return null;
  };

  const down = (e: React.PointerEvent) => {
    live.current = true;
    moved.current = false;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the gesture still bubbles */ }
    if (mode === "dots") {
      onPick(dotAt(e.clientX));
    } else {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => { if (live.current) { setPeek(true); setHover(active); } }, 240);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!live.current) return;
    if (mode === "dots") {
      const s = dotAt(e.clientX);
      if (s !== active) onPick(s);
    } else if (peek) {
      moved.current = true;
      setHover(peekAt(e.clientY));
    }
  };
  const up = () => {
    if (!live.current) return;
    live.current = false;
    window.clearTimeout(holdTimer.current);
    if (mode === "peek") {
      if (peek) {
        if (hover && hover !== active) onPick(hover);
        setPeek(false);
        setHover(null);
      } else {
        // a tap: the next one up
        const i = items.findIndex((x) => x.slot === active);
        onPick(items[(i + 1) % items.length].slot);
      }
    }
  };

  return (
    <div className="switcher" data-mode={mode}>
      <AnimatePresence>
        {peek && (
          <motion.div className="peek" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {[...items].reverse().map((it, i) => (
              <motion.div
                key={it.slot}
                ref={(el) => { if (el) peekRows.current.set(it.slot, el); else peekRows.current.delete(it.slot); }}
                className="peek-row"
                data-on={hover === it.slot}
                data-current={it.slot === active}
                initial={{ y: 28 * (i + 1), scale: 0.92, opacity: 0 }}
                animate={{ y: 0, scale: hover === it.slot ? 1.03 : 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 30, delay: i * 0.025 }}
              >
                <span className="emoji">{it.emoji}</span>
                <span className="peek-txt"><b>{it.label}</b><span>{it.name}</span></span>
                {it.sat !== undefined && <span className="peek-sat">{it.sat.toFixed(1)} g</span>}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={row}
        className="switcher-row"
        role="group"
        aria-label="Switch meal"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {items.map((it) => {
          const on = it.slot === active;
          return (
            <motion.button
              key={it.slot}
              className="switch-dot"
              data-on={on}
              aria-label={`${it.label}: ${it.name}`}
              aria-pressed={on}
              animate={{ width: on ? 86 : 12 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(it.slot); } }}
            >
              <span className="switch-label">{on ? it.label : ""}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
