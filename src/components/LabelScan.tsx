import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { foods } from "../core/content";
import { parseLabel, type LabelNumbers } from "../core/label";
import { readLabelImage } from "../core/ocr";
import type { Food, Product } from "../core/types";
import { foodMap } from "../app/viewModel";
import { AISLES } from "../app/aisles";
import { newFoodProblem } from "../core/newfood";
import { Sheet } from "./Sheets";

export interface LabelResult {
  /** The food in the list, or null when this label is for a new food (see `newFood`). */
  foodId: string | null;
  name: string;
  packG: number;
  /** What one pack cost, in rand. */
  price?: number;
  /** Packs to add to the pantry now. */
  packsBought?: number;
  newFood?: { emoji: string; aisle: string };
  per100: { kcal: number; sat: number; na: number; fibre?: number; sol?: number };
}

type Seed = { foodId: string | null; product?: Product; /** Start a new food with this name. */ newName?: string };

const EMOJI = ["🛒", "🍫", "🥜", "🍪", "🥣", "🥫", "🍞", "🧀", "🥛", "🍗", "🐟", "🥬", "🍎", "🧃", "🍝", "🍚"];

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
      {seed && <LabelFlow key={`${seed.foodId ?? "new"}-${seed.newName ?? ""}`} seed={seed} onSave={onSave} />}
    </Sheet>
  );
}

/** The scan steps on their own, so another sheet (a meal being built) can run them inline. */
export function LabelFlow({ seed, onSave }: { seed: { foodId: string | null; product?: Product; newName?: string }; onSave: (r: LabelResult) => void }) {
  const [foodId, setFoodId] = useState<string | null>(seed.foodId);
  const [query, setQuery] = useState("");
  // A food that isn't in the list yet: named here, created when the label is saved.
  const [fresh, setFresh] = useState<{ name: string; emoji: string; aisle: string } | null>(seed.newName !== undefined ? { name: seed.newName, emoji: "🛒", aisle: "Tins & dry goods" } : null);
  const [naming, setNaming] = useState(seed.newName !== undefined);
  const [price, setPrice] = useState(seed.product?.lastPrice ? String(seed.product.lastPrice) : "");
  const [bought, setBought] = useState(0);
  const [values, setValues] = useState<Record<string, string>>((): Record<string, string> => {
    const p = seed.product;
    if (!p) return {};
    return { kcal: String(p.per100.kcal), sat: String(p.per100.sat), sodium: String(p.per100.na), fibre: p.per100.fibre !== undefined ? String(p.per100.fibre) : "" };
  });
  const [brand, setBrand] = useState(seed.product?.name ?? "");
  const [pack, setPack] = useState(seed.product?.packG ? String(seed.product.packG) : "");
  const [packRead, setPackRead] = useState(false);
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
    for (const k of p.found) if (k !== "packG") next[k] = String(p[k]);
    setValues(next);
    if (p.packG) { setPack(String(p.packG)); setPackRead(true); }
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
  const nutritionOk = FIELDS.filter((f) => f.required).every((f) => num(f.key) !== undefined);
  const packNum = Number(pack) || 0;
  const subject = food ?? (fresh && !naming ? { emoji: fresh.emoji, name: fresh.name.trim() } : null);
  const ready = !!subject && nutritionOk && (!!food || packNum > 0);

  if (!food && fresh && naming) {
    const problem = newFoodProblem({ name: fresh.name, emoji: fresh.emoji, aisle: fresh.aisle, packG: 1, per100: { kcal: 0, sat: 0, na: 0 } });
    return (
      <>
        <p className="k-sub">What is it called, and where do you find it? It joins your food list, so you can stock it, shop for it and use it in your own meals.</p>
        <label className="me-field"><span className="me-label">Name</span><span className="me-input"><input autoFocus value={fresh.name} placeholder="e.g. Nutty crunch bar" aria-label="Food name" onChange={(e) => setFresh({ ...fresh, name: e.target.value })} /></span></label>
        <div className="chips emoji-row" role="group" aria-label="Icon">
          {EMOJI.map((e) => (<button key={e} className="chip" aria-pressed={fresh.emoji === e} aria-label={`Icon ${e}`} onClick={() => setFresh({ ...fresh, emoji: e })}>{e}</button>))}
        </div>
        <div className="chips" role="group" aria-label="Aisle">
          {AISLES.map((a) => (<button key={a} className="chip" aria-pressed={fresh.aisle === a} onClick={() => setFresh({ ...fresh, aisle: a })}>{a}</button>))}
        </div>
        <div className="sheet-actions">
          <button className="btn ghost" onClick={() => { setFresh(null); setNaming(false); }}>Back</button>
          <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!!problem} onClick={() => setNaming(false)}>{problem ?? "Next: the label"}</motion.button>
        </div>
      </>
    );
  }

  if (!subject) {
    return (
      <>
        <p className="k-sub">Which food is this label for? The numbers replace the food list's for that item.</p>
        <label className="me-field"><span className="me-input"><input autoFocus value={query} placeholder="Search the food list" aria-label="Search foods" onChange={(e) => setQuery(e.target.value)} /></span></label>
        {matches.map((f) => (<button key={f.id} className="krow" onClick={() => setFoodId(f.id)}><span className="emoji">{f.emoji}</span><span className="kname">{f.name}</span></button>))}
        <button className="krow add-new" onClick={() => { setFresh({ name: query.trim(), emoji: "🛒", aisle: "Tins & dry goods" }); setNaming(true); }}>
          <span className="emoji">＋</span><span className="kname">{query.trim() ? `Add “${query.trim()}” as a new food` : "Not in the list? Add a new food"}<small>For anything the food list doesn't have</small></span>
        </button>
      </>
    );
  }

  if (!confirm) {
    return (
      <>
        <div className="own-row"><span className="emoji">{subject.emoji}</span><span className="kname">{subject.name}{!food && <small>New food</small>}</span><button className="link" onClick={() => { if (food) setFoodId(null); else setNaming(true); }}>{food ? "Change" : "Edit"}</button></div>
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
      <div className="own-row"><span className="emoji">{subject.emoji}</span><span className="kname">{subject.name}{!food && <small>New food</small>}</span><button className="link" onClick={() => setConfirm(false)}>Rescan</button></div>
      {note && <p className="k-sub" role="status">{note}</p>}
      <p className="k-sub">Check these against the pack. All numbers are per 100 g (or 100 ml).</p>
      {food && <label className="me-field"><span className="me-label">Product name <span className="optional">Optional</span></span><span className="me-input"><input value={brand} placeholder={`e.g. ${food.name} brand`} aria-label="Product name" onChange={(e) => setBrand(e.target.value)} /></span></label>}
      <div className="me-grid two">
        {FIELDS.map((f) => (
          <label key={f.key} className="me-field">
            <span className="me-label">{f.label}{f.required ? "" : " (optional)"}</span>
            <span className="me-input"><input inputMode="decimal" value={values[f.key] ?? ""} placeholder={values[f.key] ? "" : "not found"} aria-label={f.label} onChange={(e) => setValues({ ...values, [f.key]: e.target.value.replace(/[^0-9.,]/g, "") })} /><span>{f.unit}</span></span>
          </label>
        ))}
      </div>
      <div className="me-grid two">
        <label className="me-field"><span className="me-label">Pack size{food ? <span className="optional"> Optional</span> : ""}</span><span className="me-input"><input inputMode="decimal" value={pack} aria-label="Pack size" placeholder="not found" onChange={(e) => { setPack(e.target.value.replace(/[^0-9.]/g, "")); setPackRead(false); }} /><span>g</span></span></label>
        <label className="me-field"><span className="me-label">One pack cost <span className="optional">Optional</span></span><span className="me-input"><span>R</span><input inputMode="decimal" value={price} aria-label="Price of one pack" onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} /></span></label>
      </div>
      {packRead && <p className="k-sub" role="status">Pack size read from the label. Check it against the pack.</p>}
      <div className="own-row bought">
        <span className="kname">Add to the pantry now<small>{bought > 0 && packNum > 0 ? `${bought} × ${packNum} g` : "Packs you just bought"}</small></span>
        <div className="stepper" role="group" aria-label="Packs bought">
          <button aria-label="One fewer" onClick={() => setBought(Math.max(0, bought - 1))}>−</button>
          <b>{bought}</b>
          <button aria-label="One more" onClick={() => setBought(bought + 1)}>+</button>
        </div>
      </div>
      {food && <p className="k-sub">Soluble fibre isn't printed on labels, so it's estimated from the food (marked est.).</p>}
      <div className="sheet-actions">
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!ready} onClick={() => {
          const fibre = num("fibre");
          const priceNum = Number(price.replace(",", ".")) || undefined;
          onSave({
            foodId: food?.id ?? null,
            name: food ? brand.trim() || food.name : subject.name,
            packG: packNum, price: priceNum, packsBought: bought || undefined,
            newFood: !food && fresh ? { emoji: fresh.emoji, aisle: fresh.aisle } : undefined,
            per100: { kcal: num("kcal")!, sat: num("sat")!, na: num("sodium")!, ...(fibre !== undefined ? { fibre, ...(food ? { sol: estimateSoluble(food, fibre) } : {}) } : {}) },
          });
        }}>{ready ? (food ? "Save label" : "Save new food") : !nutritionOk ? "Energy, saturated fat and sodium needed" : "How big is one pack?"}</motion.button>
      </div>
    </>
  );
}
