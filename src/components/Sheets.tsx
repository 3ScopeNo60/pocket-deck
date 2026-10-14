import { Drawer } from "vaul";
import { motion } from "motion/react";
import { TONIGHT, type Tonight } from "../data/meals";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <Drawer.Title className="sheet-title">{title}</Drawer.Title>
          <div className="sheet-body">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const HINTS: Record<Tonight, string> = {
  light: "Soup, salad or a small plate",
  normal: "A regular home-cooked meal",
  heavy: "Braai, curry, takeaway or a celebration",
};

/** Mid-day heads-up: "tonight's turned into a braai". Re-plans the meals still to come. */
export function TonightSheet({ open, current, onClose, onPick }: { open: boolean; current: Tonight; onClose: () => void; onPick: (t: Tonight) => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="What's tonight looking like?">
      <div className="checkin-opts">
        {(Object.keys(TONIGHT) as Tonight[]).map((t) => (
          <motion.button key={t} className="checkin-opt" aria-pressed={current === t} whileTap={{ scale: 0.97 }} onClick={() => onPick(t)}>
            <span className="checkin-icon"><span className="emoji">{TONIGHT[t].icon}</span></span>
            <span className="checkin-txt"><b>{TONIGHT[t].label}</b><span>{HINTS[t]}</span></span>
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}
