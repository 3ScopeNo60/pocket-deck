import { useEffect, useLayoutEffect, useRef } from "react";

const ITEM = 44;
const pad = (n: number) => String(n).padStart(2, "0");

function Wheel({ values, index, label, onPick }: { values: string[]; index: number; label: string; onPick: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);

  // Follow the value when it's changed from outside (another dose chosen); a no-op after our own scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollTop - index * ITEM) > 1) el.scrollTop = index * ITEM;
  }, [index]);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  return (
    <div
      ref={ref}
      className="wheel"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        window.clearTimeout(settle.current);
        // Report only a landing on a different value, so our own initial positioning is a no-op.
        settle.current = window.setTimeout(() => {
          const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM)));
          if (i !== index) onPick(i);
        }, 90);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); onPick(Math.min(values.length - 1, index + 1)); ref.current!.scrollTo({ top: (index + 1) * ITEM, behavior: "smooth" }); }
        if (e.key === "ArrowUp") { e.preventDefault(); onPick(Math.max(0, index - 1)); ref.current!.scrollTo({ top: (index - 1) * ITEM, behavior: "smooth" }); }
      }}
    >
      {values.map((v, i) => (
        <div key={v} role="option" aria-selected={i === index} className={i === index ? "wheel-item on" : "wheel-item"}>{v}</div>
      ))}
    </div>
  );
}

/** Apply one wheel's change to a "HH:MM" value without touching the other part. */
export function mergeTime(value: string, part: { h?: number; m?: number }): string {
  const [h, m] = value.split(":").map(Number);
  return `${pad(part.h ?? h)}:${pad(part.m ?? m)}`;
}

/**
 * Hours and minutes you scroll, snapping to each value. `step` is the minute interval (5 by
 * default). Each wheel reports only its own part, so two wheels settling together can't
 * overwrite each other: merge with `mergeTime` in a state updater.
 */
export function TimeWheel({ value, onChange, step = 5 }: { value: string; onChange: (part: { h?: number; m?: number }) => void; step?: number }) {
  const [h, m] = value.split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = Array.from({ length: 60 / step }, (_, i) => pad(i * step));
  const mi = Math.min(minutes.length - 1, Math.round(m / step));
  return (
    <div className="timewheel" role="group" aria-label={`Time, ${value}`}>
      <div className="wheel-band" aria-hidden="true" />
      <Wheel values={hours} index={h} label="Hour" onPick={(i) => onChange({ h: i })} />
      <span className="wheel-colon" aria-hidden="true">:</span>
      <Wheel values={minutes} index={mi} label="Minutes" onPick={(i) => onChange({ m: Number(minutes[i]) })} />
    </div>
  );
}
