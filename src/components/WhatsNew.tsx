import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { RELEASE_NOTES, type WhatsNew } from "../app/updates";
import { dayLabel, groupReleases } from "../core/whatsnew";
import { Sheet } from "./Sheets";

/** The newest release up top as "In this update"; everything older is folded under its day. */
export function WhatsNewSheet({ whats, today, onClose }: { whats: WhatsNew | null; today: string; onClose: () => void }) {
  return (
    <Sheet open={!!whats} onOpenChange={(o) => !o && onClose()} title={RELEASE_NOTES.title}>
      {whats && <Body fresh={whats.fresh} today={today} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ fresh, today, onClose }: { fresh: number; today: string; onClose: () => void }) {
  const g = groupReleases(RELEASE_NOTES.releases, fresh);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <h3 className="section-label">In this update</h3>
      <ul className="reasons whats-new">{g.fresh.flatMap((r) => r.notes).map((n) => (<li key={n}>{n}</li>))}</ul>
      {g.days.length > 0 && <h3 className="section-label">Earlier</h3>}
      <div className="whats-days">
        {g.days.map((d) => {
          const isOpen = open === d.date;
          return (
            <div key={d.date} className="whats-day" data-open={isOpen}>
              <button className="whats-day-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.date)}>
                <span className="kname">{dayLabel(d.date, today)}<small>{d.notes.length} {d.notes.length === 1 ? "change" : "changes"}</small></span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} aria-hidden><ChevronDown size={20} /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.3, 0.7, 0.2, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <ul className="reasons whats-new">{d.notes.map((n) => (<li key={n}>{n}</li>))}</ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="sheet-actions"><button className="btn wide" onClick={onClose}>Got it</button></div>
    </>
  );
}
