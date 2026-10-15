import { useRef } from "react";
import { motion } from "motion/react";

export interface SwitchItem {
  slot: string;
  label: string;
  emoji: string;
  name: string;
  sat?: number;
  nearMiss?: boolean;
}

export type SwitcherMode = "off" | "dots";

/**
 * Lets you see what's coming without finishing what's in front: the cards stay a stack, and
 * this brings whichever one you want to the top. A dot per uneaten meal. Touch one to bring
 * that card up; keep your thumb down and slide across them to riffle through the stack.
 */
export function CardSwitcher({ items, active, mode, onPick }: { items: SwitchItem[]; active: string; mode: SwitcherMode; onPick: (slot: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const live = useRef(false);
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

  const down = (e: React.PointerEvent) => {
    live.current = true;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the gesture still bubbles */ }
    onPick(dotAt(e.clientX));
  };
  const move = (e: React.PointerEvent) => {
    if (!live.current) return;
    const s = dotAt(e.clientX);
    if (s !== active) onPick(s);
  };
  const up = () => { live.current = false; };

  return (
    <div className="switcher" data-mode={mode}>
      <div ref={row} className="switcher-row" role="group" aria-label="Switch meal" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
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
