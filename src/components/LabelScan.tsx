import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { foods } from "../core/content";
import { parseLabel, type LabelNumbers } from "../core/label";
import { readLabelImage } from "../core/ocr";
import type { Food, Product } from "../core/types";
import { foodMap } from "../app/viewModel";
import { Sheet } from "./Sheets";

export interface LabelResult {
  foodId: string;
  name: string;
  packG: number;
  per100: { kcal: number; sat: number; na: number; fibre?: number; sol?: number };
}

type Seed = { foodId: string | null; product?: Product };

const FIELDS: { key: keyof LabelNumbers; label: string; unit: string; required?: boolean }[] = [
  { key: "kcal", label: "Energy", unit: "kcal", required: true },
  { key: "sat", label: "Saturated fat", unit: "g", required: true },
  { key: "sodium", label: "Sodium", unit: "mg", required: true },
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "fat", label: "Total fat", unit: "g" },
  { key: "carbs", label: "Carbohydrate", unit: "g" },
  { key: "protein", label: "Protein", unit: "g" },
];

/** A soluble-fibre figure for a branded product: labels don't print it, so scale the food list's ratio. */
export function estimateSoluble(food: Food, fibre: number): number {
  if (food.per100.fibre > 0) return Math.round(fibre * (food.per100.sol / food.per100.fibre) * 10) / 10;
  return food.per100.sol;
}

/** "Scan a label": pick the food, read a photo or pasted text, confirm the numbers. */
export function LabelScanSheet({ seed, onClose, onSave }: { seed: Seed | null; onClose: () => void; onSave: (r: LabelResult) => void }) {
  return (
    <Sheet open={!!seed} onOpenChange={(o) => !o && onClose()} title="Scan a label">
      {seed && <Flow key={seed.foodId ?? "new"} seed={seed} onSave={onSave} />}
    </Sheet>
  );
}

function Flow({ seed, onSave }: { seed: Seed; onSave: (r: LabelResult) => void }) {
  const [foodId, setFoodId] = useState<string | null>(seed.foodId);
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>((): Record<string, string> => {
    const p = seed.product;
    if (!p) return {};
    return { kcal: String(p.per100.kcal), sat: String(p.per100.sat), sodium: String(p.per100.na), fibre: p.per100.fibre !== undefined ? String(p.per100.fibre) : "" };
  });
  const [brand, setBrand] = useState(seed.product?.name ?? "");
  const [pack, setPack] = useState(seed.product?.packG ? String(seed.product.packG) : "");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(!!seed.product);
  const camera = useRef<HTMLInputElement>(null);
  const photos = useRef<HTMLInputElement>(null);

  const food = foodId ? foodMap.get(foodId) ?? null : null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  const apply = (text: string) => {
    const p = parseLabel(text);
    const next: Record<string, string> = {};
    for (const k of p.found) next[k] = String(p[k]);
    setValues(next);
    setConfirm(true);
    setNote(p.found.length === 0 ? "I couldn't find a nutrition table in that. You can type the numbers in." : p.found.length < 3 ? "I only found a few numbers. Check them against the pack." : null);
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy("Reading the label…");
    try {
      const text = await readLabelImage(file, (pr) => setBusy(`Reading the label… ${Math.round(pr * 100)}%`));
      apply(text);
    } catch {
      setNote("Reading photos needs the installed app and a first-time download. Paste the label text instead, or type the numbers.");
      setConfirm(true);
    } finally {
      setBusy(null);
    }
  };

  const num = (k: string) => { const n = Number((values[k] ?? "").replace(",", ".")); return values[k]?.trim() && Number.isFinite(n) && n >= 0 ? n : undefined; };
  const ready = !!food && FIELDS.filter((f) => f.required).every((f) => num(f.key) !== undefined);

  if (!food) {
    return (
      <>
        <p className="k-sub">Which food is this label for? The numbers replace the food list's for that item.</p>
        <label className="me-field"><span className="me-input"><input autoFocus value={query} placeholder="Search the food list" aria-label="Search foods" onChange={(e) => setQuery(e.target.value)} /></span></label>
        {matches.map((f) => (<button key={f.id} className="krow" onClick={() => setFoodId(f.id)}><span className="emoji">{f.emoji}</span><span className="kname">{f.name}</span></button>))}
      </>
    );
  }

  if (!confirm) {
    return (
      <>
        <div className="own-row"><span className="emoji">{food.emoji}</span><span className="kname">{food.name}</span><button className="link" onClick={() => setFoodId(null)}>Change</button></div>
        {busy ? (
          <p className="k-sub" role="status">{busy}</p>
        ) : (
          <>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label="Take a photo" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
            <input ref={photos} type="file" accept="image/*" hidden aria-label="Choose a photo" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
            <div className="blood-actions">
              <button className="btn" onClick={() => camera.current?.click()}>Take a photo</button>
              <button className="btn ghost" onClick={() => photos.current?.click()}>Choose from Photos</button>
            </div>
            <p className="k-sub">Fill the frame with the nutrition table and hold steady. It's read on this phone and the photo isn't kept.</p>
            <label className="me-field">
              <span className="me-label">Or paste the label text <span className="optional">Live Text works well</span></span>
              <textarea className="own-steps" rows={4} value={pasted} aria-label="Label text" onChange={(e) => setPasted(e.target.value)} />
            </label>
            <div className="blood-actions">
              <button className="btn small" disabled={!pasted.trim()} onClick={() => apply(pasted)}>Read the text</button>
              <button className="btn small ghost" onClick={() => { setValues({}); setConfirm(true); }}>Type the numbers</button>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="own-row"><span className="emoji">{food.emoji}</span><span className="kname">{food.name}</span><button className="link" onClick={() => setConfirm(false)}>Rescan</button></div>
      {note && <p className="k-sub" role="status">{note}</p>}
      <p className="k-sub">Check these against the pack. All numbers are per 100 g (or 100 ml).</p>
      <label className="me-field"><span className="me-label">Product name <span className="optional">Optional</span></span><span className="me-input"><input value={brand} placeholder={`e.g. ${food.name} brand`} aria-label="Product name" onChange={(e) => setBrand(e.target.value)} /></span></label>
      <div className="me-grid two">
        {FIELDS.map((f) => (
          <label key={f.key} className="me-field">
            <span className="me-label">{f.label}{f.required ? "" : " (optional)"}</span>
            <span className="me-input"><input inputMode="decimal" value={values[f.key] ?? ""} placeholder={values[f.key] ? "" : "not found"} aria-label={f.label} onChange={(e) => setValues({ ...values, [f.key]: e.target.value.replace(/[^0-9.,]/g, "") })} /><span>{f.unit}</span></span>
          </label>
        ))}
      </div>
      <label className="me-field"><span className="me-label">Pack size <span className="optional">Optional</span></span><span className="me-input"><input inputMode="decimal" value={pack} aria-label="Pack size" onChange={(e) => setPack(e.target.value.replace(/[^0-9.]/g, ""))} /><span>g</span></span></label>
      <p className="k-sub">Soluble fibre isn't printed on labels, so it's estimated from the food (marked est.).</p>
      <div className="sheet-actions">
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!ready} onClick={() => {
          const fibre = num("fibre");
          onSave({
            foodId: food.id, name: brand.trim() || food.name, packG: Number(pack) || 0,
            per100: { kcal: num("kcal")!, sat: num("sat")!, na: num("sodium")!, ...(fibre !== undefined ? { fibre, sol: estimateSoluble(food, fibre) } : {}) },
          });
        }}>{ready ? "Save label" : "Energy, saturated fat and sodium needed"}</motion.button>
      </div>
    </>
  );
}
