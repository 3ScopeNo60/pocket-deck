import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { foods } from "../core/content";
import { matchLine, parseOrder } from "../core/order";
import { readPlainImage } from "../core/ocr";
import type { Food } from "../core/types";
import { Sheet } from "./Sheets";

export interface OrderRow { foodId: string; packs: number; packG: number; price?: number }

interface Row {
  key: number;
  name: string;
  foodId: string;
  packs: number;
  packG: string;
  total: string;
  note?: string;
  /** Why a likely match was left on Skip. */
  hint?: string;
}

const money = (n: number | undefined) => (n === undefined ? "" : String(n));

/** "Import an order": paste the cart or order screen, or give screenshots; check each line; restock. */
export function OrderImportSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (rows: OrderRow[]) => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Import an order">
      {open && <Flow onApply={onApply} />}
    </Sheet>
  );
}

function Flow({ onApply }: { onApply: (rows: OrderRow[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const photos = useRef<HTMLInputElement>(null);
  const sorted = useMemo(() => [...foods].sort((a, b) => a.name.localeCompare(b.name)), []);

  const read = (source: string) => {
    const lines = parseOrder(source);
    if (lines.length === 0) {
      setNote("I couldn't find any items in that. Each item needs its \"Qty\" line, as on the order screen.");
      return;
    }
    setRows(lines.map((l, i): Row => {
      const m = matchLine(l, foods);
      // A processed product that only contains a food's name ("apple juice") is not that food.
      const hint = m?.unsure ? `Looks like ${m.food.name.toLowerCase()}, but it says "${m.unsure}". Pick the food if it really is.` : undefined;
      return { key: i, name: l.name, foodId: m && !m.unsure ? m.food.id : "", packs: l.qty, packG: String(m?.packG ?? l.packG ?? ""), total: money(l.total), note: m?.note, hint };
    }));
    setNote(null);
  };

  const fromPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      let all = "";
      for (let i = 0; i < files.length; i++) {
        setBusy(`Reading screenshot ${i + 1} of ${files.length}…`);
        all += `${await readPlainImage(files[i], (p) => setBusy(`Reading screenshot ${i + 1} of ${files.length}… ${Math.round(p * 100)}%`))}\n`;
      }
      setText(all.trim());
      read(all);
    } catch {
      setNote("Reading photos needs the installed app and a first-time download. Paste the text of the order instead.");
    } finally {
      setBusy(null);
    }
  };

  if (!rows) {
    return (
      <>
        <p className="k-sub">Open your Sixty60 cart or order and screenshot it (a long one in a few screenshots), or paste its text. I read each item, its pack size, how many and what it cost.</p>
        <input ref={photos} type="file" accept="image/*" multiple hidden aria-label="Choose screenshots" onChange={(e) => void fromPhotos(e.target.files)} />
        {busy ? (
          <p className="k-sub" role="status">{busy}</p>
        ) : (
          <>
            <div className="blood-actions">
              <button className="btn" onClick={() => photos.current?.click()}>Choose screenshots</button>
            </div>
            <label className="me-field">
              <span className="me-label">Or paste the order text</span>
              <textarea className="own-steps" rows={5} value={text} aria-label="Order text" onChange={(e) => setText(e.target.value)} />
            </label>
            {note && <p className="k-sub" role="status">{note}</p>}
            <div className="blood-actions">
              <button className="btn small" disabled={!text.trim()} onClick={() => read(text)}>Read the order</button>
            </div>
          </>
        )}
      </>
    );
  }

  const set = (key: number, patch: Partial<Row>) => setRows((all) => all && all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ready = rows.filter((r) => r.foodId && r.packs > 0 && Number(r.packG) > 0);
  const unmatched = rows.filter((r) => !r.foodId).length;
  return (
    <>
      <p className="k-sub">{rows.length} item{rows.length === 1 ? "" : "s"} read. Check what each one is, the pack size and what it cost. Anything left on "Skip" is left out.</p>
      {rows.map((r) => {
        const f = r.foodId ? sorted.find((x) => x.id === r.foodId) : undefined;
        return (
          <div key={r.key} className="order-row" data-skipped={!r.foodId}>
            <div className="order-name">{r.name}</div>
            <div className="order-grid">
              <label className="order-food">
                <span className="emoji">{f?.emoji ?? "➖"}</span>
                <select aria-label={`What ${r.name} is`} value={r.foodId} onChange={(e) => set(r.key, { foodId: e.target.value })}>
                  <option value="">Skip</option>
                  {sorted.map((x: Food) => (<option key={x.id} value={x.id}>{x.name}</option>))}
                </select>
              </label>
              <div className="stepper" role="group" aria-label={`${r.name} packs`}>
                <button aria-label="One fewer" onClick={() => set(r.key, { packs: Math.max(0, r.packs - 1) })}>−</button>
                <b>{r.packs}</b>
                <button aria-label="One more" onClick={() => set(r.key, { packs: r.packs + 1 })}>+</button>
              </div>
              <label className="me-input"><input inputMode="decimal" aria-label={`${r.name} pack size`} value={r.packG} onChange={(e) => set(r.key, { packG: e.target.value.replace(/[^0-9.]/g, "") })} /><span>g</span></label>
              <label className="price"><span>R</span><input inputMode="decimal" placeholder="total" aria-label={`${r.name} price`} value={r.total} onChange={(e) => set(r.key, { total: e.target.value.replace(/[^0-9.,]/g, "") })} /></label>
            </div>
            {r.note && r.foodId && <div className="k-sub">{r.note}</div>}
            {!r.foodId && <div className="k-sub">{r.hint ?? "Not one of your foods, so it's left out. If it is food, add it with the plus in Scan a label, then import again."}</div>}
          </div>
        );
      })}
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => setRows(null)}>Back</button>
        <motion.button
          className="btn wide"
          whileTap={{ scale: 0.96 }}
          disabled={ready.length === 0}
          onClick={() => onApply(ready.map((r) => ({ foodId: r.foodId, packs: r.packs, packG: Number(r.packG), price: r.total ? Number(r.total.replace(",", ".")) || undefined : undefined })))}
        >
          {ready.length === 0 ? "Nothing to add" : `Add ${ready.length} to the pantry${unmatched ? ` · ${unmatched} skipped` : ""}`}
        </motion.button>
      </div>
    </>
  );
}
