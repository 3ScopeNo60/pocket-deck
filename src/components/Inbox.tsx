import { Bell, CalendarCheck, NotebookPen, Droplets, Package, Pill, RefreshCw, Save, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import type { InboxItem, InboxKind } from "../core/inbox";
import { Sheet } from "./Sheets";

const ICONS: Record<InboxKind, LucideIcon> = {
  update: RefreshCw, backlog: NotebookPen, newmeals: Sparkles, shopping: ShoppingCart, low: Package, refill: Pill, labs: Droplets, lookback: CalendarCheck, backup: Save,
};

/** The bell: the same glass disc and line icon as the menu's options, top right. */
export function BellButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <div className="bell-wrap" data-surface="glass">
      <button className="bell gpane" onClick={onOpen} aria-label={count > 0 ? `Notifications, ${count} new` : "Notifications"}>
        <Bell size={19} strokeWidth={2} />
        {count > 0 && <span className="bell-count" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
      </button>
    </div>
  );
}

export function InboxSheet({ open, items, read, onClose, onAct }: { open: boolean; items: InboxItem[]; read: string[]; onClose: () => void; onAct: (item: InboxItem, key: "open" | "dismiss") => void }) {
  const fresh = items.filter((x) => !read.includes(x.id));
  const older = items.filter((x) => read.includes(x.id));
  const row = (x: InboxItem, isNew: boolean) => {
    const Icon = ICONS[x.kind];
    return (
      <div key={x.id} className="inbox-item" data-new={isNew} data-kind={x.kind}>
        <span className="inbox-icon" aria-hidden="true"><Icon size={19} strokeWidth={2} /></span>
        <div className="inbox-body">
          <b>{x.title}</b>
          <span>{x.detail}</span>
          <div className="inbox-actions">
            {x.actions.map((a) => (
              <button key={a.key} className={a.key === "open" ? "btn small" : "btn small ghost"} onClick={() => onAct(x, a.key)}>{a.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Notifications">
      {items.length === 0 ? (
        <p className="k-empty">Nothing needs you right now.</p>
      ) : (
        <>
          {fresh.length > 0 && <><h3 className="section-label">New</h3>{fresh.map((x) => row(x, true))}</>}
          {older.length > 0 && <><h3 className="section-label">Earlier</h3>{older.map((x) => row(x, false))}</>}
        </>
      )}
    </Sheet>
  );
}
