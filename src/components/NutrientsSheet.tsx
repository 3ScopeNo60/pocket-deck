import { NUTRIENTS, showValue, type NKey, type Totals } from "../core/nutrients";
import { Sheet } from "./Sheets";

export interface Limit { limit: number; kind: "max" | "goal"; unit: string }

/** Every nutrient marker for a meal or a day, with how it sits against his limits where there is one. */
export function NutrientsSheet({ open, title, subtitle, totals, limits, notes, onClose }: {
  open: boolean; title: string; subtitle?: string; totals: Totals | null; limits: Partial<Record<NKey, Limit>>; notes: string[]; onClose: () => void;
}) {
  const groups = [...new Set(NUTRIENTS.map((n) => n.group))];
  return (
    <Sheet open={open && !!totals} onOpenChange={(o) => !o && onClose()} title={title}>
      {totals && (
        <>
          {subtitle && <p className="k-sub">{subtitle}</p>}
          {groups.map((g) => (
            <section key={g} className="nut-group">
              <h3 className="section-label">{g}</h3>
              <dl className="nut-list">
                {NUTRIENTS.filter((n) => n.group === g).map((n) => {
                  const lim = limits[n.key];
                  const pct = lim && totals.known[n.key] ? Math.round((totals.values[n.key] / lim.limit) * 100) : null;
                  return (
                    <div key={n.key} className={n.sub ? "nut-row sub" : "nut-row"} data-known={totals.known[n.key]}>
                      <dt>{n.label}</dt>
                      <dd>
                        {showValue(totals, n.key)}
                        {pct !== null && <span className="nut-pct" data-over={lim!.kind === "max" && pct > 100}>{pct}% of {lim!.kind === "max" ? "limit" : "goal"}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
          <p className="k-sub">A + means some ingredient has no number for it, so the real figure is at least this. "Not known" means none of them do. All are estimates; see how the numbers are worked out.</p>
          {notes.map((n) => (<p key={n} className="k-sub">{n}</p>))}
        </>
      )}
    </Sheet>
  );
}
