import { useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { toast } from "sonner";
import { foods } from "../core/content";
import { formatAmount, isLow, listTotal, stepGrams, unlockList } from "../core/stock";
import { meals } from "../core/content";
import type { Food, Prefs, Product, ShoppingItem, StockItem } from "../core/types";
import { AISLES, FLAVOUR_KIT, aisleOf } from "../app/aisles";
import { foodMap } from "../app/viewModel";
import { Sheet } from "./Sheets";
import { OwnMealSheet } from "./OwnMeal";
import { LabelScanSheet, type LabelResult } from "./LabelScan";
import { OrderImportSheet } from "./OrderImport";
import { NO_RINSE_HINT } from "../core/rinse";
import { OWN_TAG, type MealDraft } from "../core/custom";
import type { Meal } from "../core/types";

type Section = "list" | "pantry" | "unlock" | "kit";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "list", label: "List" },
  { key: "pantry", label: "Pantry" },
  { key: "unlock", label: "Unlock" },
  { key: "kit", label: "Flavour" },
];

export interface KitchenActions {
  addToList: (needs: { foodId: string; needG: number }[], reason: ShoppingItem["reason"]) => number;
  addMealToList: (mealId: string) => number;
  setListItem: (foodId: string, packs: number, packG: number) => void;
  toggleChecked: (id: string) => void;
  removeFromList: (id: string) => void;
  restock: (rows: { foodId: string; packs: number; packG: number; price?: number }[], listIds?: string[]) => void;
  setStockGrams: (foodId: string, grams: number) => void;
  setMealState: (mealId: string, state: "kept" | "hidden") => void;
  addOwnMeal: (d: MealDraft) => Promise<Meal>;
  saveLabel: (r: LabelResult) => string | null;
}

interface Props {
  stock: StockItem[];
  shopping: ShoppingItem[];
  products: Map<string, Product>;
  prefs: Prefs;
  actions: KitchenActions;
  initial?: Section;
}

const R = (n: number) => `R${n.toLocaleString("en-ZA")}`;

export function Kitchen({ stock, shopping, products, prefs, actions, initial = "list" }: Props) {
  const [section, setSection] = useState<Section>(initial);
  const [restock, setRestock] = useState<RestockSeed | null>(null);
  const [adjust, setAdjust] = useState<string | null>(null);
  const [picker, setPicker] = useState<"list" | "restock" | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const [scan, setScan] = useState<{ foodId: string | null; product?: Product; newName?: string } | null>(null);
  const [qty, setQty] = useState<{ foodId: string; packs: number; packG: number; editing: boolean } | null>(null);
  const go = (s: Section) => { setSection(s); window.scrollTo({ top: 0 }); };

  const have = useMemo(() => new Map(stock.filter((s) => s.kind === "food").map((s) => [s.itemId, s.grams])), [stock]);
  const unlock = useMemo(() => unlockList(meals, foodMap, stock, prefs), [stock, prefs]);
  const own = useMemo(() => meals.filter((m) => m.tags.includes(OWN_TAG) && prefs.meals[m.id]?.state !== "hidden"), [prefs]);
  const hidden = useMemo(() => meals.filter((m) => prefs.meals[m.id]?.state === "hidden"), [prefs]);
  const onList = useMemo(() => new Set(shopping.map((r) => r.itemId)), [shopping]);
  /** The pack he last bought of a food (or read off its label), else the smallest on the shelf. */
  const usualPack = (f: Food) => { const g = products.get(f.id)?.packG; return g && g > 0 ? g : Math.min(...f.packSizes); };

  return (
    <div className="kitchen">
      <header>
        <h1 className="hello">Kitchen</h1>
      </header>

      <div className="seg seg-4" role="group" aria-label="Kitchen sections">
        <LayoutGroup id="kitchen-seg">
          {SECTIONS.map((s) => (
            <button key={s.key} aria-pressed={section === s.key} onClick={() => go(s.key)}>
              {section === s.key && <motion.span layoutId="k-thumb" className="seg-thumb" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="seg-label">
                {s.label}
                {s.key === "list" && shopping.length > 0 && <i className="count">{shopping.length}</i>}
                {s.key === "unlock" && unlock.length > 0 && <i className="count">{unlock.length}</i>}
              </span>
            </button>
          ))}
        </LayoutGroup>
      </div>

      {section === "list" && (
        <ShoppingList
          shopping={shopping}
          products={products}
          actions={actions}
          onAdd={() => setPicker("list")}
          onEdit={(r) => setQty({ foodId: r.itemId, packs: r.packs, packG: r.shopUnitG, editing: true })}
          onDone={() => {
            const rows = shopping.some((r) => r.checked) ? shopping.filter((r) => r.checked) : shopping;
            setRestock({ rows: rows.map((r) => ({ foodId: r.itemId, packs: r.packs, packG: r.shopUnitG, listId: r.id })) });
          }}
        />
      )}

      {section === "pantry" && (
        <section className="k-section">
          <div className="k-head">
            <h3 className="section-label">What you have</h3>
            <div className="blood-actions">
              <button className="btn small ghost" onClick={() => setScan({ foodId: null })}>Scan a label</button>
              <button className="btn small" onClick={() => setPicker("restock")}>Restock</button>
            </div>
          </div>
          <button className="krow add-new" onClick={() => setOrderOpen(true)}>
            <span className="emoji">🧾</span>
            <span className="kname">Import an order<small>From your Sixty60 cart or order: sizes, quantities and prices</small></span>
          </button>
          {[...products.values()].some((p) => p.fromLabel) && (
            <div className="aisle">
              <div className="aisle-name">Scanned labels</div>
              {[...products.values()].filter((p) => p.fromLabel).map((p) => {
                const f = foodMap.get(p.foodId);
                return (
                  <div key={p.id} className="krow static">
                    <span className="emoji">{f?.emoji}</span>
                    <span className="kname">{p.name}<small>{p.per100.kcal} kcal · {p.per100.sat} g sat fat · {p.per100.na} mg sodium per 100 g</small></span>
                    <button className="link" onClick={() => setScan({ foodId: p.foodId, product: p })}>Edit</button>
                  </div>
                );
              })}
            </div>
          )}
          {foods.filter((f) => (have.get(f.id) ?? 0) > 0).length === 0 ? (
            <p className="k-empty">Nothing recorded yet. Tap Restock after your next shop.</p>
          ) : (
            AISLES.map((a) => {
              const rows = foods.filter((f) => aisleOf(f.id) === a && (have.get(f.id) ?? 0) > 0);
              if (!rows.length) return null;
              return (
                <div key={a} className="aisle">
                  <div className="aisle-name">{a}</div>
                  {rows.map((f) => {
                    const g = have.get(f.id)!;
                    return (
                      <button key={f.id} className="krow" onClick={() => setAdjust(f.id)}>
                        <span className="emoji">{f.emoji}</span>
                        <span className="kname">{f.name}{products.get(f.id)?.needsRinse && <small>Needs rinsing</small>}</span>
                        <span className={isLow(f, g) ? "pill low" : "pill"}>{formatAmount(f, g)}{isLow(f, g) ? " · low" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </section>
      )}

      {section === "unlock" && (
        <section className="k-section">
          <div className="k-head">
            <h3 className="section-label">Meals to unlock</h3>
            <button className="btn small" onClick={() => setOwnOpen(true)}>Add your own meal</button>
          </div>
          {unlock.length === 0 ? (
            <p className="k-empty">Every meal you'd eat is ready to make.</p>
          ) : (
            unlock.map(({ meal, missing }) => {
              const listed = missing.every((m) => onList.has(m.foodId));
              return (
                <motion.article key={meal.id} className="unlock" layout>
                  <div className="unlock-title">
                    <span className="icon-tile small"><span className="emoji">{meal.emoji}</span></span>
                    <div>
                      <h4 className="name small">{meal.name}</h4>
                      <p className="k-sub">{missing.length === 1 ? "One thing to pick up" : `${missing.length} things to pick up`}</p>
                    </div>
                  </div>
                  <ul className="items">
                    {missing.map((m) => {
                      const f = foodMap.get(m.foodId)!;
                      return (
                        <li key={m.foodId} className="item need">
                          <span className="emoji">{f.emoji}</span>
                          <span className="what">{f.name}</span>
                          <span className="pill">short {formatAmount(f, m.needG - m.haveG)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="actions">
                    <button className="btn ghost small" onClick={() => actions.setMealState(meal.id, "hidden")}>Not for me</button>
                    <motion.button
                      className="btn small"
                      disabled={listed}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        const n = actions.addMealToList(meal.id);
                        toast(n ? `Added ${n} ${n === 1 ? "thing" : "things"} to your list` : "Already on your list");
                      }}
                    >
                      {listed ? "On your list" : "Add missing to list"}
                    </motion.button>
                  </div>
                </motion.article>
              );
            })
          )}

          {own.length > 0 && (
            <div className="aisle">
              <div className="aisle-name">Your own meals</div>
              {own.map((m) => (
                <div key={m.id} className="krow static">
                  <span className="emoji">{m.emoji}</span>
                  <span className="kname">{m.name}</span>
                  <button className="link" onClick={() => actions.setMealState(m.id, "hidden")}>Hide</button>
                </div>
              ))}
            </div>
          )}

          {hidden.length > 0 && (
            <div className="aisle">
              <div className="aisle-name">Hidden meals</div>
              {hidden.map((m) => (
                <div key={m.id} className="krow static">
                  <span className="emoji">{m.emoji}</span>
                  <span className="kname">{m.name}</span>
                  <button className="link" onClick={() => actions.setMealState(m.id, "kept")}>Bring back</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "kit" && (
        <section className="k-section">
          <h3 className="section-label">Flavour kit</h3>
          <p className="k-sub">A few cheap things that make plain food taste like something. They last for months.</p>
          {FLAVOUR_KIT.map((id) => {
            const f = foodMap.get(id)!;
            const has = (have.get(id) ?? 0) > 0;
            return (
              <div key={id} className="krow static">
                <span className="emoji">{f.emoji}</span>
                <span className="kname">{f.name}<small>{has ? "In the pantry" : "Not yet"}</small></span>
                {has ? (
                  <span className="pill">✓</span>
                ) : onList.has(id) ? (
                  <span className="pill">On list</span>
                ) : (
                  <button className="btn small" onClick={() => { actions.addToList([{ foodId: id, needG: usualPack(f) }], "manual"); toast(`${f.name} is on your list`); }}>Add</button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <PickFoodSheet
        open={picker !== null}
        title={picker === "restock" ? "What did you buy?" : "Add to your list"}
        onClose={() => setPicker(null)}
        onPick={(f) => {
          const mode = picker;
          setPicker(null);
          if (mode === "restock") setRestock({ rows: [{ foodId: f.id, packs: 1, packG: usualPack(f) }] });
          else setQty({ foodId: f.id, packs: 1, packG: usualPack(f), editing: false });
        }}
        onAddNew={(name) => { setPicker(null); setScan({ foodId: null, newName: name }); }}
      />
      <QuantitySheet
        seed={qty}
        onClose={() => setQty(null)}
        onSave={(foodId, packs, packG) => {
          actions.setListItem(foodId, packs, packG);
          setQty(null);
          toast(`${foodMap.get(foodId)!.name} is on your list`);
        }}
        onRemove={(foodId) => {
          actions.removeFromList(`s-${foodId}`);
          setQty(null);
        }}
      />
      <RestockSheet
        seed={restock}
        products={products}
        onClose={() => setRestock(null)}
        onSave={(rows, ids) => {
          actions.restock(rows, ids);
          setRestock(null);
          toast(rows.length === 1 ? "Stocked up" : `${rows.length} things stocked up`);
        }}
      />
      <OrderImportSheet
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        onApply={(rows) => {
          actions.restock(rows, []);
          setOrderOpen(false);
          toast(`${rows.length} thing${rows.length === 1 ? "" : "s"} added to the pantry`);
        }}
      />
      <AdjustSheet
        food={adjust ? foodMap.get(adjust) ?? null : null}
        grams={adjust ? have.get(adjust) ?? 0 : 0}
        onClose={() => setAdjust(null)}
        onSave={(g) => {
          if (adjust) actions.setStockGrams(adjust, g);
          setAdjust(null);
        }}
      />
      <OwnMealSheet open={ownOpen} onClose={() => setOwnOpen(false)} products={products} onNewFood={(r) => actions.saveLabel(r)} onSave={(d) => { setOwnOpen(false); void actions.addOwnMeal(d).then((m) => toast(`${m.name} is in your rotation`)); }} />
      <LabelScanSheet seed={scan} onClose={() => setScan(null)} onSave={(r) => {
        const id = actions.saveLabel(r);
        setScan(null);
        const name = id ? foodMap.get(id)?.name ?? r.name : r.name;
        toast(!r.foodId ? `${name} is in your food list${r.packsBought ? " and your pantry" : ""}` : r.packsBought ? `Label saved, ${r.packsBought} added to the pantry` : "Label saved. Meals with it use these numbers.");
      }} />
    </div>
  );
}

/* ── shopping list ─────────────────────────────────────────── */

const REASON: Record<ShoppingItem["reason"], string> = { plan: "For your week", unlock: "To unlock a meal", low: "Running low", manual: "Added by you" };

function ShoppingList({ shopping, products, actions, onAdd, onDone, onEdit }: {
  shopping: ShoppingItem[]; products: Map<string, Product>; actions: KitchenActions; onAdd: () => void; onDone: () => void; onEdit: (r: ShoppingItem) => void;
}) {
  const { total, unpriced } = listTotal(shopping, products);
  const ticked = shopping.filter((r) => r.checked).length;
  return (
    <section className="k-section">
      <div className="k-head">
        <h3 className="section-label">{shopping.length ? `${shopping.length} to buy` : "Shopping list"}</h3>
        <button className="btn ghost small" onClick={onAdd}>Add something</button>
      </div>

      {shopping.length === 0 ? (
        <p className="k-empty">Nothing on the list. Meals you can't make yet are under Unlock, and anything running low shows in Pantry.</p>
      ) : (
        <>
          {AISLES.map((a) => {
            const rows = shopping.filter((r) => aisleOf(r.itemId) === a);
            if (!rows.length) return null;
            return (
              <div key={a} className="aisle">
                <div className="aisle-name">{a}</div>
                {rows.map((r) => {
                  const f = foodMap.get(r.itemId)!;
                  return (
                    <div key={r.id} className={r.checked ? "krow ticked" : "krow"}>
                      <button className="tickbtn" aria-pressed={r.checked} aria-label={`${f.name} in the trolley`} onClick={() => actions.toggleChecked(r.id)}>
                        <span className="box" />
                      </button>
                      <span className="emoji">{f.emoji}</span>
                      <span className="kname">{f.name}<small>{REASON[r.reason]}</small>{products.get(r.itemId)?.needsRinse && <small className="rinse-hint">{NO_RINSE_HINT}</small>}</span>
                      <button className="pill editable" aria-label={`Change how much ${f.name}`} onClick={() => onEdit(r)}>{r.packs} × {r.shopUnitG} g</button>
                      <button className="link" aria-label={`Remove ${f.name}`} onClick={() => actions.removeFromList(r.id)}>×</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <p className="k-sub total">
            {total > 0 ? `About ${R(total)}` : "No prices yet"}
            {unpriced > 0 && total > 0 ? ` · ${unpriced} not priced yet` : ""}
          </p>
          <motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={onDone}>
            {ticked ? `Done shopping · ${ticked} in the trolley` : "Done shopping"}
          </motion.button>
        </>
      )}
    </section>
  );
}

/* ── sheets ────────────────────────────────────────────────── */

interface RestockRow { foodId: string; packs: number; packG: number; listId?: string }
interface RestockSeed { rows: RestockRow[] }

function RestockSheet({ seed, products, onClose, onSave }: {
  seed: RestockSeed | null; products: Map<string, Product>; onClose: () => void;
  onSave: (rows: { foodId: string; packs: number; packG: number; price?: number }[], listIds: string[]) => void;
}) {
  return (
    <Sheet open={!!seed} onOpenChange={(o) => !o && onClose()} title="What did you get?">
      {seed && <RestockForm key={seed.rows.map((r) => r.foodId).join(",")} seed={seed} products={products} onSave={onSave} />}
    </Sheet>
  );
}

/** Pack size: the usual ones as chips, plus any grams he types for a pack that isn't on the list. */
function PackSize({ food, value, onChange, label }: { food: Food; value: number; onChange: (g: number) => void; label: string }) {
  const sizes = [...new Set([...food.packSizes, value])].filter((g) => g > 0).sort((a, b) => a - b);
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="packsize">
      <div className="chips" role="group" aria-label={label}>
        {sizes.map((g) => (<button key={g} className="chip" aria-pressed={!other && value === g} onClick={() => { setOther(false); onChange(g); }}>{g} g</button>))}
        <button className="chip" aria-pressed={other} onClick={() => setOther(true)}>Other</button>
      </div>
      {other && (
        <label className="me-input packsize-other">
          <input autoFocus inputMode="decimal" aria-label={`${label}, grams`} placeholder="Grams in one pack" value={text}
            onChange={(e) => { const t = e.target.value.replace(/[^0-9]/g, ""); setText(t); if (Number(t) > 0) onChange(Number(t)); }} />
          <span>g</span>
        </label>
      )}
    </div>
  );
}

function RestockForm({ seed, products, onSave }: { seed: RestockSeed; products: Map<string, Product>; onSave: (rows: { foodId: string; packs: number; packG: number; price?: number }[], listIds: string[]) => void }) {
  const [rows, setRows] = useState(() => seed.rows.map((r) => ({ ...r, price: "" })));
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      <p className="k-sub">Set how many packs you bought and, if you like, what you paid. Prices are only used to estimate your list and week.</p>
      {rows.map((r, i) => {
        const f = foodMap.get(r.foodId) as Food;
        const last = products.get(r.foodId)?.lastPrice;
        return (
          <div key={r.foodId} className="restock-row">
            <span className="emoji">{f.emoji}</span>
            <span className="kname">{f.name}<small>{r.packs} × {r.packG} g{last ? ` · last R${last.toFixed(2)} a pack` : ""}</small></span>
            <div className="stepper" role="group" aria-label={`${f.name} packs`}>
              <button aria-label="One fewer" onClick={() => set(i, { packs: Math.max(0, r.packs - 1) })}>−</button>
              <b>{r.packs}</b>
              <button aria-label="One more" onClick={() => set(i, { packs: r.packs + 1 })}>+</button>
            </div>
            <label className="price">
              <span>R</span>
              <input inputMode="decimal" placeholder="total" aria-label={`${f.name} price`} value={r.price} onChange={(e) => set(i, { price: e.target.value.replace(/[^0-9.,]/g, "") })} />
            </label>
            <PackSize food={f} value={r.packG} label={`${f.name} pack size`} onChange={(g) => set(i, { packG: g })} />
          </div>
        );
      })}
      <div className="sheet-actions">
        <motion.button
          className="btn wide"
          whileTap={{ scale: 0.96 }}
          onClick={() =>
            onSave(
              rows.filter((r) => r.packs > 0).map((r) => ({ foodId: r.foodId, packs: r.packs, packG: r.packG, price: r.price ? Number(r.price.replace(",", ".")) || undefined : undefined })),
              seed.rows.map((r) => r.listId).filter((x): x is string => !!x),
            )
          }
        >
          Add to pantry
        </motion.button>
      </div>
    </>
  );
}

function QuantitySheet({ seed, onClose, onSave, onRemove }: {
  seed: { foodId: string; packs: number; packG: number; editing: boolean } | null;
  onClose: () => void; onSave: (foodId: string, packs: number, packG: number) => void; onRemove: (foodId: string) => void;
}) {
  const food = seed ? foodMap.get(seed.foodId) ?? null : null;
  return (
    <Sheet open={!!seed && !!food} onOpenChange={(o) => !o && onClose()} title={food ? food.name : ""}>
      {seed && food && <QuantityForm key={seed.foodId} seed={seed} food={food} onSave={onSave} onRemove={onRemove} />}
    </Sheet>
  );
}

function QuantityForm({ seed, food, onSave, onRemove }: {
  seed: { foodId: string; packs: number; packG: number; editing: boolean }; food: Food;
  onSave: (foodId: string, packs: number, packG: number) => void; onRemove: (foodId: string) => void;
}) {
  const [packs, setPacks] = useState(seed.packs);
  const [packG, setPackG] = useState(seed.packG);
  return (
    <>
      <p className="k-sub">How many do you need to buy? Pick the pack size you'd usually take off the shelf.</p>
      <div className="adjust">
        <button aria-label="One fewer" onClick={() => setPacks(Math.max(1, packs - 1))}>−</button>
        <div className="adjust-n"><span className="emoji">{food.emoji}</span><b>{packs} × {packG} g</b></div>
        <button aria-label="One more" onClick={() => setPacks(packs + 1)}>+</button>
      </div>
      <PackSize food={food} value={packG} label="Pack size" onChange={setPackG} />
      <div className="sheet-actions">
        {seed.editing && <button className="btn ghost" onClick={() => onRemove(seed.foodId)}>Remove</button>}
        <motion.button className="btn" whileTap={{ scale: 0.96 }} onClick={() => onSave(seed.foodId, packs, packG)}>
          {seed.editing ? "Save" : "Add to list"}
        </motion.button>
      </div>
    </>
  );
}

function AdjustSheet({ food, grams, onClose, onSave }: { food: Food | null; grams: number; onClose: () => void; onSave: (g: number) => void }) {
  return (
    <Sheet open={!!food} onOpenChange={(o) => !o && onClose()} title={food ? `How much ${food.name.toLowerCase()}?` : ""}>
      {food && <AdjustForm key={food.id} food={food} grams={grams} onSave={onSave} />}
    </Sheet>
  );
}

function AdjustForm({ food, grams, onSave }: { food: Food; grams: number; onSave: (g: number) => void }) {
  const [g, setG] = useState(grams);
  const step = stepGrams(food);
  return (
    <>
      <p className="k-sub">Fix the amount if what's in the cupboard has drifted from what the app thinks.</p>
      <div className="adjust">
        <button aria-label="Less" onClick={() => setG(Math.max(0, g - step))}>−</button>
        <div className="adjust-n"><span className="emoji">{food.emoji}</span><b>{formatAmount(food, g)}</b></div>
        <button aria-label="More" onClick={() => setG(g + step)}>+</button>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => onSave(0)}>All gone</button>
        <motion.button className="btn" whileTap={{ scale: 0.96 }} onClick={() => onSave(g)}>Save</motion.button>
      </div>
    </>
  );
}

function PickFoodSheet({ open, title, onClose, onPick, onAddNew }: { open: boolean; title: string; onClose: () => void; onPick: (f: Food) => void; onAddNew: (name: string) => void }) {
  const [q, setQ] = useState("");
  // `foods` grows when he adds one from a label, so key the list on its length too.
  const list = useMemo(() => foods.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [q, open, foods.length]);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setQ(""); onClose(); } }} title={title}>
      <input className="search" placeholder="Search foods" aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {list.map((f) => (
          <button key={f.id} className="krow" onClick={() => { setQ(""); onPick(f); }}>
            <span className="emoji">{f.emoji}</span>
            <span className="kname">{f.name}</span>
          </button>
        ))}
        <button className="krow add-new" onClick={() => { const name = q.trim(); setQ(""); onAddNew(name); }}>
          <span className="emoji">＋</span><span className="kname">{q.trim() ? `Add “${q.trim()}” as a new food` : "Not here? Add a new food"}<small>From its nutrition label</small></span>
        </button>
      </div>
    </Sheet>
  );
}

