import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { foods } from "../core/content";
import { buildCustomMeal, draftProblem, type MealDraft } from "../core/custom";
import { mealNutrition } from "../core/nutrition";
import type { Meal, Product } from "../core/types";
import { foodMap } from "../app/viewModel";
import { Sheet } from "./Sheets";
import { LabelFlow, type LabelResult } from "./LabelScan";

const EMOJI = ["🍳", "🥣", "🥪", "🥗", "🍲", "🍛", "🥙", "🍎", "🍞", "🥜"];
const SLOT_LABEL: Record<Meal["slot"], string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack" };
const BLANK: MealDraft = { name: "", emoji: "🍳", slot: "lunch", items: [], steps: "" };

/** "Add your own meal": pick ingredients and amounts; the numbers are worked out from the food list. */
export function OwnMealSheet({ open, onClose, onSave, onNewFood, products }: { open: boolean; onClose: () => void; onSave: (d: MealDraft) => void; onNewFood: (r: LabelResult) => string | null; products: Map<string, Product> }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Add your own meal">
      {open && <Form onSave={onSave} onNewFood={onNewFood} products={products} />}
    </Sheet>
  );
}

function Form({ onSave, onNewFood, products }: { onSave: (d: MealDraft) => void; onNewFood: (r: LabelResult) => string | null; products: Map<string, Product> }) {
  const [d, setD] = useState<MealDraft>(BLANK);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // An ingredient that isn't in the food list yet: read off its label, then straight into the meal.
  const [fresh, setFresh] = useState<string | null>(null);

  const problem = draftProblem(d, foodMap);
  const nums = useMemo(() => {
    if (d.items.length === 0 || draftProblem({ ...d, name: "x" }, foodMap)) return null;
    const m = buildCustomMeal({ ...d, name: "x" }, new Set(), foodMap);
    return mealNutrition(m, foodMap, products);
  }, [d, products]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(d.items.map((i) => i.foodId));
    return foods.filter((f) => !used.has(f.id) && (!q || f.name.toLowerCase().includes(q))).slice(0, 8);
  }, [query, d.items]);

  const addFood = (foodId: string) => {
    const measure = Object.keys(foodMap.get(foodId)!.measures)[0];
    setD({ ...d, items: [...d.items, { foodId, measure }] });
    setQuery("");
    setAdding(false);
  };

  if (fresh !== null) {
    return (
      <>
        <h3 className="section-label">A new ingredient</h3>
        <LabelFlow
          seed={{ foodId: null, newName: fresh }}
          onSave={(r) => {
            const id = onNewFood(r);
            setFresh(null);
            if (id) addFood(id);
          }}
        />
        <div className="sheet-actions"><button className="btn ghost" onClick={() => setFresh(null)}>Back to the meal</button></div>
      </>
    );
  }

  return (
    <>
      <label className="me-field">
        <span className="me-label">Name</span>
        <span className="me-input"><input value={d.name} placeholder="e.g. Mom's lentil soup" aria-label="Meal name" onChange={(e) => setD({ ...d, name: e.target.value })} /></span>
      </label>

      <div className="emoji-row" role="group" aria-label="Picture">
        {EMOJI.map((e) => (<button key={e} aria-pressed={d.emoji === e} aria-label={`Use ${e}`} onClick={() => setD({ ...d, emoji: e })}><span className="emoji">{e}</span></button>))}
      </div>

      <div className="seg seg-3" role="group" aria-label="Which meal">
        {(Object.keys(SLOT_LABEL) as Meal["slot"][]).map((s) => (<button key={s} aria-pressed={d.slot === s} onClick={() => setD({ ...d, slot: s })}>{SLOT_LABEL[s]}</button>))}
      </div>

      <h3 className="section-label">What's in it</h3>
      {d.items.map((it, i) => {
        const f = foodMap.get(it.foodId)!;
        return (
          <div key={it.foodId} className="own-row">
            <span className="emoji">{f.emoji}</span>
            <span className="kname">{f.name}</span>
            <select aria-label={`Amount of ${f.name}`} value={it.measure} onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, measure: e.target.value } : x)) })}>
              {Object.keys(f.measures).map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            <button className="link" aria-label={`Remove ${f.name}`} onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        );
      })}

      {adding ? (
        <div className="own-find">
          <label className="me-field">
            <span className="me-input"><input autoFocus value={query} placeholder="Search the food list" aria-label="Search foods" onChange={(e) => setQuery(e.target.value)} /></span>
          </label>
          {matches.map((f) => (
            <button key={f.id} className="krow" onClick={() => addFood(f.id)}><span className="emoji">{f.emoji}</span><span className="kname">{f.name}</span></button>
          ))}
          {matches.length === 0 && <p className="k-sub">Nothing like that in the food list yet.</p>}
          <button className="krow add-new" onClick={() => setFresh(query.trim())}>
            <span className="emoji">＋</span><span className="kname">{query.trim() ? `Add “${query.trim()}” as a new ingredient` : "Not in the list? Add a new ingredient"}<small>From its nutrition label</small></span>
          </button>
        </div>
      ) : (
        <button className="btn ghost small" onClick={() => setAdding(true)}>Add an ingredient</button>
      )}

      <label className="me-field">
        <span className="me-label">How you make it <span className="optional">Optional, one step per line</span></span>
        <textarea className="own-steps" rows={3} value={d.steps} aria-label="Steps" onChange={(e) => setD({ ...d, steps: e.target.value })} />
      </label>

      {nums && (
        <dl className="nums">
          <div><dt>Sat fat</dt><dd>{nums.sat.toFixed(1)} g</dd></div>
          <div><dt>Sol. fibre</dt><dd>{nums.sol.toFixed(1)} g</dd></div>
          <div><dt>Sodium</dt><dd>{Math.round(nums.na)} mg</dd></div>
          <div><dt>Energy</dt><dd>{Math.round(nums.kcal)} kcal</dd></div>
        </dl>
      )}

      <div className="sheet-actions">
        <motion.button className="btn" whileTap={{ scale: 0.96 }} disabled={!!problem} onClick={() => onSave(d)}>{problem ?? "Save meal"}</motion.button>
      </div>
    </>
  );
}
