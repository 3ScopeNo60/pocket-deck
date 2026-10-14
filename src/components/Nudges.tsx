import { motion } from "motion/react";
import type { PeriodSummary } from "../core/score";

/** Sunday's quiet look back at the week. Never a verdict: what happened, and one thing to try. */
export function LookBack({ summary, onOpen, onDismiss }: { summary: PeriodSummary; onOpen: () => void; onDismiss: () => void }) {
  const facts = [
    summary.medDays ? `tablet on ${summary.medDays.taken} of ${summary.medDays.expected}` : null,
    `moved on ${summary.movedDays}`,
    summary.takeaways ? `${summary.takeaways} takeaway ${summary.takeaways === 1 ? "supper" : "suppers"}` : null,
  ].filter(Boolean);
  return (
    <motion.section className="nudge" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="section-label">Your week</h3>
      <p className="nudge-head">{summary.headline}</p>
      <p className="nudge-facts">{facts.join(" · ")}</p>
      {summary.suggestions[0] && <p className="nudge-try">{summary.suggestions[0]}</p>}
      <div className="nudge-actions">
        <button className="btn small" onClick={onOpen}>See the summary</button>
        <button className="btn small ghost" onClick={onDismiss}>Not now</button>
      </div>
    </motion.section>
  );
}

export function BackupNudge({ words, onOpen, onDismiss }: { words: string; onOpen: () => void; onDismiss: () => void }) {
  return (
    <motion.section className="nudge" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="section-label">Back up</h3>
      <p className="nudge-head">{words}</p>
      <p className="nudge-facts">Everything lives only on this phone. One file in Files or iCloud Drive keeps it safe.</p>
      <div className="nudge-actions">
        <button className="btn small" onClick={onOpen}>Back up now</button>
        <button className="btn small ghost" onClick={onDismiss}>Remind me next week</button>
      </div>
    </motion.section>
  );
}
