import { useId } from "react";
import { LayoutGroup, motion } from "motion/react";

/** A segmented choice whose selection slides from one option to the next rather than jumping. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div className={`seg seg-${options.length} seg-slide`} role="group" aria-label={label}>
      <LayoutGroup id={id}>
        {options.map((o) => (
          <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.value === value && <motion.span layoutId="seg-thumb" className="seg-thumb" transition={{ type: "spring", stiffness: 520, damping: 36 }} />}
            <span className="seg-label">{o.label}</span>
          </button>
        ))}
      </LayoutGroup>
    </div>
  );
}
