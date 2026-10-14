import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as db from "../core/db";
import { addCustomMeal, estCost, meals, startingMealIds, suppers } from "../core/content";
import { buildCustomMeal, OWN_PREFIX, type MealDraft } from "../core/custom";
import { addDays } from "./history";
import { decideMeal, discoverMeals, pendingMeals } from "../core/discover";
import { mealGrams, mealNutrition, targets } from "../core/nutrition";
import { doneSlots, offPlanSat } from "../core/offplan";
import { dayBudget, deal, isReady, nextFitting, reserved, shortfall, supperSat, SLOTS, type DealOptions, type Slot, type Tonight } from "../core/planner";
import type { Day, LastNight, Lab, Med, Prefs, Product, Profile, ShoppingItem, StockItem, Week } from "../core/types";
import { addNeeds, addToStock, restockGrams, type Need } from "../core/stock";
import { needsFor, planWeek, swapInWeek, tagTonight, type WeekPlan } from "../core/week";
import { DEFAULT_PROFILE, defaultPrefs, starterStock } from "./defaults";
import { foodMap, mealMap, supperMap } from "./viewModel";

export interface Answer {
  lastNight: LastNight | null;
  tonight: Tonight;
}

/** A failed write must never break the screen: the app keeps working in memory. */
const persist = (p: Promise<unknown>): Promise<void> => p.then(() => undefined, () => undefined);

const todayKey = (d = new Date()) => d.toLocaleDateString("en-CA");
const hhmm = (d = new Date()) => d.toTimeString().slice(0, 5);
const plus = (d: Date, days: number) => todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));

function newDay(date: string, a: Answer, plan: Day["plan"]): Day {
  return { date, lastNight: a.lastNight, tonight: a.tonight, plan, eaten: [], extras: [], replaced: [], walk: false };
}

/** Saturated fat from unplanned food today, beyond what the plan already counts. */
function overageOf(d: Day | null): number {
  if (!d) return 0;
  return offPlanSat(d, (slot) => {
    const id = d.plan[slot as Slot];
    const m = id ? mealMap.get(id) : null;
    return m ? mealNutrition(m, foodMap).sat : 0;
  });
}

/** Today's saturated fat for the meals in `plan`, using each meal's real nutrition. */
function planSat(plan: Day["plan"]): number {
  return SLOTS.reduce((t, s) => {
    const m = plan[s] ? mealMap.get(plan[s]!) : null;
    return t + (m ? mealNutrition(m, foodMap).sat : 0);
  }, 0);
}

function withStock(stock: StockItem[], grams: Record<string, number>, sign: 1 | -1, at: string): { next: StockItem[]; changed: StockItem[] } {
  const byId = new Map(stock.map((s) => [s.itemId, s]));
  const changed: StockItem[] = [];
  for (const [itemId, g] of Object.entries(grams)) {
    const cur = byId.get(itemId);
    if (!cur && sign === -1) continue; // nothing recorded, nothing to take off
    const row: StockItem = { itemId, kind: "food", grams: Math.max(0, (cur?.grams ?? 0) + sign * g), updatedAt: at };
    byId.set(itemId, row);
    changed.push(row);
  }
  return { next: [...byId.values()], changed };
}

export function useApp() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs());
  const [stock, setStock] = useState<StockItem[]>([]);
  const [day, setDay] = useState<Day | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [weekRow, setWeekRow] = useState<Week | null>(null);
  const [med, setMed] = useState<Med | null>(null);
  const [allDays, setAllDays] = useState<Day[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const date = useRef(todayKey()).current;
  const latest = useRef({ profile, prefs, stock, day, shopping, products, weekRow, med });
  latest.current = { profile, prefs, stock, day, shopping, products, weekRow, med };
  const productByFood = useMemo(() => new Map(products.map((p) => [p.foodId, p])), [products]);

  // Load everything once, seeding defaults the first time the app runs.
  useEffect(() => {
    (async () => {
      try {
        let p = await db.get("profile", "me");
        const firstRun = !p; // only ever seed on the very first run: an empty pantry later is real
        if (!p) { p = DEFAULT_PROFILE; await db.put("profile", p); }
        let pr = await db.get("prefs", "me");
        if (!pr) { pr = defaultPrefs(); await db.put("prefs", pr); }
        let st = await db.getAll("stock");
        if (firstRun && !st.length) {
          st = starterStock();
          for (const row of st) await db.put("stock", row);
        }
        const d = (await db.get("days", date)) ?? null;
        const sh = await db.getAll("shopping");
        const pd = await db.getAll("products");
        const wk = (await db.getAll("week")).sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0] ?? null;
        const md = (await db.getAll("meds"))[0] ?? null;
        // His own meals live in the database; bring them into the library before anything is dealt.
        for (const own of await db.getAll("meals")) addCustomMeal(own);
        // New meals that arrived with this build wait for a decision before they're ever dealt.
        const found = discoverMeals(meals.filter((m) => !m.id.startsWith(OWN_PREFIX)).map((m) => m.id), pr);
        if (found.prefs !== pr) { pr = found.prefs; await db.put("prefs", pr); }
        setAllDays(await db.getAll("days"));
        setLabs((await db.getAll("labs")).sort((a, b) => a.date.localeCompare(b.date)));
        setProfile(p); setPrefs(pr); setStock(st); setDay(d); setShopping(sh); setProducts(pd); setWeekRow(wk); setMed(md);
      } catch {
        // Storage unavailable (private mode, blocked frame): run from defaults, in memory only.
        setStock(starterStock());
        setMemoryOnly(true);
      } finally {
        setReady(true);
      }
    })();
  }, [date]);

  const answer: Answer | null = day ? { lastNight: day.lastNight, tonight: day.tonight } : null;
  const { budget, carry } = useMemo(() => {
    const night = day?.lastNight ? supperMap.get(day.lastNight.supperId) : null;
    const base = dayBudget({
      satCap: targets(profile).satCap,
      lastNightSat: night && day?.lastNight ? supperSat(night.sat, day.lastNight.plate) : null,
      tonight: day?.tonight ?? "normal",
    });
    // Unplanned food comes out of what's left for the meals still to come.
    return { budget: base.budget - overageOf(day), carry: base.carry };
  }, [profile, day?.lastNight, day?.tonight, day?.replaced, day?.extras, day?.plan]);

  const eatenSlots = (d: Day | null) => (d ? (doneSlots(d) as Slot[]) : []);

  const optionsFor = useCallback(
    (d: Day, budgetNow: number, stockNow: StockItem[], prefsNow: Prefs): DealOptions => ({
      meals, foods: foodMap, products: productByFood, budget: budgetNow, stock: stockNow, prefs: prefsNow,
      current: d.plan, locked: eatenSlots(d), today: d.date,
    }),
    [productByFood],
  );

  const budgetFor = (profileNow: Profile, a: Answer) => {
    const night = a.lastNight ? supperMap.get(a.lastNight.supperId) : null;
    return dayBudget({ satCap: targets(profileNow).satCap, lastNightSat: night && a.lastNight ? supperSat(night.sat, a.lastNight.plate) : null, tonight: a.tonight });
  };

  /** Update state (and the ref handlers read) at once; the database write follows. */
  const saveDay = (d: Day): Promise<void> => {
    latest.current.day = d;
    setDay(d);
    setAllDays((all) => [...all.filter((x) => x.date !== d.date), d]);
    return persist(db.put("days", d));
  };

  /** First answer of the day, or a correction later: re-deal only what is still to come. */
  const submitAnswer = useCallback(async (a: Answer): Promise<string[]> => {
    const { profile: pf, prefs: pr, stock: st, day: cur } = latest.current;
    const { budget: b } = budgetFor(pf, a);
    if (!cur) {
      // Use what was planned for today in the week plan, if it still fits and is still makeable.
      const planned = latest.current.weekRow?.days[date]?.plan;
      const ids = planned ? SLOTS.map((s) => planned[s]) : [];
      const usable = planned && ids.every((id) => id && mealMap.get(id)) &&
        planSat(planned) <= b && ids.every((id) => isReady(mealMap.get(id!)!, st, {}, foodMap));
      if (usable) { await saveDay(newDay(date, a, { ...planned! })); return []; }
      const r = deal({ meals, foods: foodMap, products: new Map(latest.current.products.map((p) => [p.foodId, p])), budget: b, stock: st, prefs: pr, today: date });
      await saveDay(newDay(date, a, r.pick));
      return [];
    }
    const next: Day = { ...cur, lastNight: a.lastNight, tonight: a.tonight };
    const bLeft = b - overageOf(cur);
    if (planSat(cur.plan) <= bLeft) {
      await saveDay(next);
      return [];
    }
    const r = deal({ ...optionsFor(next, bLeft, st, pr) });
    const changed = SLOTS.filter((s) => r.pick[s] !== cur.plan[s]);
    await saveDay({ ...next, plan: { ...cur.plan, ...Object.fromEntries(SLOTS.filter((s) => !eatenSlots(cur).includes(s)).map((s) => [s, r.pick[s]])) } });
    return changed;
  }, [date, optionsFor]);

  /** Swap the card in `slot`. Returns false when nothing else fits. */
  const swap = useCallback((slot: Slot, dir: 1 | -1): boolean => {
    const { profile: pf, prefs: pr, stock: st, day: cur } = latest.current;
    if (!cur) return false;
    const id = nextFitting(optionsFor(cur, budgetFor(pf, { lastNight: cur.lastNight, tonight: cur.tonight }).budget - overageOf(cur), st, pr), slot, dir);
    if (!id || id === cur.plan[slot]) return false;
    void saveDay({ ...cur, plan: { ...cur.plan, [slot]: id } });
    return true;
  }, [optionsFor]);

  const eat = useCallback(async (slot: Slot) => {
    const { stock: st, day: cur } = latest.current;
    const id = cur?.plan[slot];
    const meal = id ? mealMap.get(id) : null;
    if (!cur || !meal || cur.eaten.some((e) => e.slot === slot)) return;
    const at = new Date();
    const { next, changed } = withStock(st, meal.bought ? {} : mealGrams(meal, foodMap), -1, at.toISOString());
    latest.current.stock = next;
    setStock(next);
    await Promise.all(changed.map((row) => persist(db.put("stock", row))));
    await saveDay({ ...cur, eaten: [...cur.eaten, { slot, mealId: meal.id, at: hhmm(at) }] });
  }, []);

  const undo = useCallback(async (slot: Slot) => {
    const { stock: st, day: cur } = latest.current;
    const entry = cur?.eaten.find((e) => e.slot === slot);
    const meal = entry ? mealMap.get(entry.mealId) : null;
    if (!cur || !entry || !meal) return;
    const { next, changed } = withStock(st, meal.bought ? {} : mealGrams(meal, foodMap), 1, new Date().toISOString());
    latest.current.stock = next;
    setStock(next);
    await Promise.all(changed.map((row) => persist(db.put("stock", row))));
    await saveDay({ ...cur, eaten: cur.eaten.filter((e) => e.slot !== slot) });
  }, []);

  /** "Not feeling it": show this meal less for a week, then swap it. */
  const notFeelingIt = useCallback((slot: Slot): boolean => {
    const { prefs: pr, day: cur } = latest.current;
    const id = cur?.plan[slot];
    if (!cur || !id) return false;
    const next: Prefs = { ...pr, meals: { ...pr.meals, [id]: { state: "kept", notFeelingUntil: plus(new Date(), 7) } } };
    setPrefs(next);
    void persist(db.put("prefs", next));
    latest.current.prefs = next;
    return swap(slot, 1);
  }, [swap]);

  /** Tick the next dose; when every dose is in, another tap takes the last one back. */
  const toggleTablet = useCallback(async () => {
    const { day: cur, med: m } = latest.current;
    if (!cur) return;
    const doses = m?.times?.length ?? 1;
    const per = m?.perDose ?? 1;
    const taken = cur.dosesTaken ?? (cur.tabletAt ? [cur.tabletAt] : []);
    const adding = taken.length < doses;
    const next = adding ? [...taken, hhmm()] : taken.slice(0, -1);
    if (m) {
      const updated: Med = { ...m, pillsLeft: Math.max(0, m.pillsLeft + (adding ? -per : per)) };
      latest.current.med = updated;
      setMed(updated);
      void persist(db.put("meds", updated));
    }
    await saveDay({ ...cur, dosesTaken: next, tabletAt: next[0] });
  }, []);

  /** Add a blood result (or replace the one for that date). */
  const saveLab = useCallback((lab: Lab) => {
    setLabs((all) => [...all.filter((x) => x.date !== lab.date), lab].sort((a, b) => a.date.localeCompare(b.date)));
    void persist(db.put("labs", lab));
  }, []);
  const deleteLab = useCallback((labDate: string) => {
    setLabs((all) => all.filter((x) => x.date !== labDate));
    void persist(db.del("labs", labDate));
  }, []);

  /** Keep a newly unlocked meal in the rotation, or put it away. */
  const decideNewMeal = useCallback((id: string, keep: boolean) => {
    const next = decideMeal(latest.current.prefs, id, keep);
    if (next === latest.current.prefs) return;
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);

  /** Tick a night-before prep job for tomorrow on or off. */
  const togglePrep = useCallback((forDate: string, mealId: string) => {
    const pr = latest.current.prefs;
    const ids = pr.prepDone?.date === forDate ? pr.prepDone.ids : [];
    const next: Prefs = { ...pr, prepDone: { date: forDate, ids: ids.includes(mealId) ? ids.filter((x) => x !== mealId) : [...ids, mealId] } };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);

  /** Say now what tonight's supper is (or take it back). Tomorrow's check-in starts from it. */
  const setSupperTonight = useCallback((s: { supperId: string; plate: "Small" | "Normal" | "Big" } | null) => {
    const pr = latest.current.prefs;
    const { supperTonight: _drop, ...rest } = pr;
    const next: Prefs = s ? { ...rest, supperTonight: { date, ...s } } : rest;
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, [date]);

  /** Save a meal he built himself and put it straight into the rotation. */
  const addOwnMeal = useCallback(async (draft: MealDraft) => {
    const meal = buildCustomMeal(draft, new Set(meals.map((m) => m.id)), foodMap);
    addCustomMeal(meal);
    const pr = latest.current.prefs;
    const next: Prefs = { ...pr, meals: { ...pr.meals, [meal.id]: { state: "kept" } } };
    latest.current.prefs = next;
    setPrefs(next);
    await persist(db.put("meals", meal));
    await persist(db.put("prefs", next));
    return meal;
  }, []);

  /** Put a quiet prompt away: the look-back until next Sunday, the backup reminder for a week. */
  const dismissNudge = useCallback((kind: "lookback" | "backup") => {
    const today = date;
    const cur = latest.current.prefs.nudges ?? {};
    const nudges = kind === "lookback" ? { ...cur, lookbackOn: today } : { ...cur, backupUntil: addDays(today, 7) };
    const next: Prefs = { ...latest.current.prefs, nudges };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, [date]);
  const markBackedUp = useCallback(() => {
    const next: Prefs = { ...latest.current.prefs, lastBackupAt: new Date().toISOString() };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);
  /** "Had something else" for a slot: it counts as done, nothing is taken out of stock. */
  const replaceSlot = useCallback(async (slot: Slot, what: string, size: string) => {
    const cur = latest.current.day;
    if (!cur || doneSlots(cur).includes(slot)) return;
    await saveDay({ ...cur, replaced: [...(cur.replaced ?? []), { slot, what, size, at: hhmm() }] });
  }, []);
  const undoReplaced = useCallback(async (slot: Slot) => {
    const cur = latest.current.day;
    if (cur) await saveDay({ ...cur, replaced: (cur.replaced ?? []).filter((r) => r.slot !== slot) });
  }, []);
  /** "+ Extra": unplanned food on top of the plan. */
  const addExtra = useCallback(async (kind: string, size: string) => {
    const cur = latest.current.day;
    if (cur) await saveDay({ ...cur, extras: [...(cur.extras ?? []), { kind, size, at: hhmm() }] });
  }, []);
  const removeExtra = useCallback(async (index: number) => {
    const cur = latest.current.day;
    if (cur) await saveDay({ ...cur, extras: (cur.extras ?? []).filter((_, i) => i !== index) });
  }, []);

  const toggleWalk = useCallback(async () => {
    const cur = latest.current.day;
    if (cur) await saveDay({ ...cur, walk: !cur.walk });
  }, []);

  /**
   * Quietly top up empty slots when the kitchen or the budget changes (a restock, a tonight
   * change). Planned meals stay put and keep their ingredients reserved.
   */
  useEffect(() => {
    if (!ready || !day) return;
    const open = SLOTS.filter((s) => !day.plan[s] && !doneSlots(day).includes(s));
    if (!open.length) return;
    const keep = SLOTS.filter((s) => !open.includes(s));
    const heldIds = SLOTS.filter((s) => day.plan[s] && !doneSlots(day).includes(s)).map((s) => day.plan[s]!);
    const r = deal({
      meals, foods: foodMap, products: productByFood, budget, stock, prefs, current: day.plan, locked: keep, today: day.date,
      reservedGrams: reserved(heldIds, mealMap, foodMap),
    });
    const filled = open.filter((s) => r.pick[s]);
    if (!filled.length) return;
    void saveDay({ ...day, plan: { ...day.plan, ...Object.fromEntries(filled.map((s) => [s, r.pick[s]])) } });
  }, [ready, day, budget, stock, prefs]);

  /* ── Kitchen ─────────────────────────────────────────────── */

  const saveShopping = (next: ShoppingItem[], removed: string[] = []) => {
    latest.current.shopping = next;
    setShopping(next);
    for (const r of next) void persist(db.put("shopping", r));
    for (const id of removed) void persist(db.del("shopping", id));
  };

  /** Put what's missing on the list. Returns how many rows were added or grown. */
  const addToList = useCallback((needs: Need[], reason: ShoppingItem["reason"]): number => {
    const before = latest.current.shopping;
    const next = addNeeds(before, needs, foodMap, reason);
    const changed = next.filter((r) => { const o = before.find((x) => x.id === r.id); return !o || o.packs !== r.packs; });
    saveShopping(next);
    return changed.length;
  }, []);

  /** "Add to list" on a meal card or an unlock entry: everything that meal is short of. */
  const addMealToList = useCallback((mealId: string, reason: ShoppingItem["reason"] = "unlock"): number => {
    const meal = mealMap.get(mealId);
    if (!meal) return 0;
    const needs = shortfall(meal, latest.current.stock, {}, foodMap).map((s) => ({ foodId: s.foodId, needG: s.needG - s.haveG }));
    return addToList(needs, reason);
  }, [addToList]);

  /** Set exactly how many packs of a food are on the list (adds the row if it's new). */
  const setListItem = useCallback((foodId: string, packs: number, packG: number) => {
    const before = latest.current.shopping;
    const cur = before.find((r) => r.itemId === foodId);
    const row: ShoppingItem = {
      id: cur?.id ?? `s-${foodId}`, itemId: foodId, kind: "food", packs: Math.max(1, packs), shopUnitG: packG,
      reason: cur?.reason ?? "manual", checked: cur?.checked ?? false, needG: Math.max(1, packs) * packG,
    };
    saveShopping([...before.filter((r) => r.id !== row.id), row]);
  }, []);

  const toggleChecked = useCallback((id: string) => {
    saveShopping(latest.current.shopping.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }, []);

  const removeFromList = useCallback((id: string) => {
    saveShopping(latest.current.shopping.filter((r) => r.id !== id), [id]);
  }, []);

  /** Bought something: stock goes up, the price is remembered, and ticked rows leave the list. */
  const restock = useCallback((rows: { foodId: string; packs: number; packG: number; price?: number }[], listIds: string[] = []) => {
    const at = new Date().toISOString();
    let st = latest.current.stock;
    let pd = latest.current.products;
    for (const r of rows) {
      const food = foodMap.get(r.foodId);
      if (!food || r.packs <= 0) continue;
      const added = addToStock(st, r.foodId, restockGrams(food, r.packs, r.packG), at);
      st = added.next;
      void persist(db.put("stock", added.row));
      const prev = pd.find((p) => p.foodId === r.foodId);
      const perPack = r.price && r.price > 0 ? r.price / r.packs : prev?.lastPrice ?? 0;
      // A restock updates the pack and price but keeps numbers read from a label.
      const product: Product = {
        id: r.foodId, foodId: r.foodId, name: prev?.name ?? food.name, packG: r.packG, lastPrice: perPack,
        estimated: prev?.estimated ?? [], fromLabel: prev?.fromLabel,
        per100: prev?.per100 ?? { kcal: food.per100.kcal, sat: food.per100.sat, na: food.per100.na },
      };
      pd = [...pd.filter((p) => p.foodId !== r.foodId), product];
      void persist(db.put("products", product));
    }
    latest.current.stock = st;
    latest.current.products = pd;
    setStock(st);
    setProducts(pd);
    saveShopping(latest.current.shopping.filter((r) => !listIds.includes(r.id)), listIds);
  }, []);

  /** Keep the numbers read from a nutrition label for a food. The planner uses them from then on. */
  const saveLabel = useCallback((r: { foodId: string; name: string; packG: number; per100: { kcal: number; sat: number; na: number; fibre?: number; sol?: number } }) => {
    const prev = latest.current.products.find((p) => p.foodId === r.foodId);
    const product: Product = {
      id: r.foodId, foodId: r.foodId, name: r.name, packG: r.packG || prev?.packG || 0, lastPrice: prev?.lastPrice ?? 0,
      per100: r.per100, estimated: r.per100.sol !== undefined ? ["sol"] : [], fromLabel: true,
    };
    const pd = [...latest.current.products.filter((p) => p.foodId !== r.foodId), product];
    latest.current.products = pd;
    setProducts(pd);
    void persist(db.put("products", product));
  }, []);

  /** Fridge check: set a food's amount directly. */
  const setStockGrams = useCallback((foodId: string, grams: number) => {
    const row: StockItem = { itemId: foodId, kind: "food", grams: Math.max(0, Math.round(grams)), updatedAt: new Date().toISOString() };
    const next = [...latest.current.stock.filter((s) => !(s.itemId === foodId && s.kind === "food")), row];
    latest.current.stock = next;
    setStock(next);
    void persist(db.put("stock", row));
  }, []);

  /** Preview-only: jump to a state that's slow to reach by tapping. Never wired into the real build. */
  const devScenario = useCallback(async (name: "fresh-day" | "braai" | "empty-kitchen" | "stocked" | "reset" | "history" | "new-meals") => {
    const wipe = async (store: "stock" | "shopping" | "products" | "days") => {
      for (const row of await db.getAll(store).catch(() => [])) {
        const key = store === "stock" ? (row as StockItem).itemId : store === "days" ? (row as Day).date : (row as { id: string }).id;
        void persist(db.del(store, key));
      }
    };
    if (name === "fresh-day") {
      void persist(db.del("days", date));
      latest.current.day = null;
      setDay(null);
    } else if (name === "braai") {
      await submitAnswer({ lastNight: { supperId: "braai", plate: "Big" }, tonight: "heavy" });
    } else if (name === "history") {
      // A month of plausible days, so Progress has something to show. Preview only.
      let seed = 7;
      const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const pickOne = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
      const sample: Med = latest.current.med ?? { id: "med-1", name: "Sample tablet", dose: "10 mg", time: "20:00", times: ["20:00"], perDose: 1, packSize: 30, pillsLeft: 18, takenLog: [] };
      if (!latest.current.med) { latest.current.med = sample; setMed(sample); void persist(db.put("meds", sample)); }
      const made: Day[] = [];
      for (let k = 1; k <= 34; k++) {
        const d = addDays(date, -k);
        const skipped = rnd() < 0.12;
        const s = pickOne(suppers);
        made.push({
          date: d, tonight: "normal", plan: { breakfast: null, lunch: null, snack: null },
          lastNight: rnd() < 0.1 ? null : { supperId: s.id, plate: pickOne(["Small", "Normal", "Normal", "Big"] as const) },
          eaten: skipped ? [] : SLOTS.map((slot) => ({ slot, mealId: pickOne(meals.filter((m) => m.slot === slot)).id, at: "12:00" })),
          extras: [], replaced: [], walk: rnd() < 0.5,
          dosesTaken: rnd() < 0.78 ? (sample.times ?? ["20:00"]).map(() => "20:00") : [],
        });
      }
      setAllDays((all) => [...all.filter((x) => !made.some((m) => m.date === x.date)), ...made]);
      for (const m of made) void persist(db.put("days", m));
      const sampleLabs: Lab[] = [
        { date: addDays(date, -95), ldl: 4.6, total: 6.7, hdl: 1.1, trig: 1.8 },
        { date: addDays(date, -48), ldl: 4.1, total: 6.1, hdl: 1.2, trig: 1.6 },
        { date: addDays(date, -9), ldl: 3.6, total: 5.5, hdl: 1.3, trig: 1.4, note: "After 3 months" },
      ];
      setLabs(sampleLabs);
      for (const l of sampleLabs) void persist(db.put("labs", l));
    } else if (name === "new-meals") {
      // Pretend an update just shipped three meals: they wait for a decision.
      const fresh = meals.filter((m) => !startingMealIds.includes(m.id)).slice(0, 3).map((m) => m.id);
      const next: Prefs = { ...latest.current.prefs, meals: { ...latest.current.prefs.meals, ...Object.fromEntries(fresh.map((id) => [id, { state: "new" as const }])) } };
      latest.current.prefs = next;
      setPrefs(next);
      void persist(db.put("prefs", next));
    } else if (name === "empty-kitchen") {
      await wipe("stock");
      latest.current.stock = [];
      setStock([]);
    } else if (name === "stocked") {
      const all = foodMap.size ? [...foodMap.keys()].map((id) => ({ itemId: id, kind: "food" as const, grams: 2000, updatedAt: new Date().toISOString() })) : [];
      latest.current.stock = all;
      setStock(all);
      for (const r of all) void persist(db.put("stock", r));
    } else {
      await Promise.all([wipe("stock"), wipe("shopping"), wipe("products"), wipe("days")]);
      const st = starterStock();
      const keep = { ...defaultPrefs(), setupDone: true };
      latest.current = { ...latest.current, stock: st, shopping: [], products: [], day: null, prefs: keep, profile: DEFAULT_PROFILE };
      setStock(st); setShopping([]); setProducts([]); setDay(null); setPrefs(keep); setProfile(DEFAULT_PROFILE);
      for (const r of st) void persist(db.put("stock", r));
      void persist(db.put("profile", DEFAULT_PROFILE));
      void persist(db.put("prefs", keep));
    }
  }, [date, submitAnswer]);

  const saveProfile = useCallback((next: Profile) => {
    latest.current.profile = next;
    setProfile(next);
    void persist(db.put("profile", next));
  }, []);

  /* ── Week ────────────────────────────────────────────────── */

  const weekInput = () => {
    const { profile: pf, prefs: pr, stock: st, day: cur, products: pd } = latest.current;
    const held = cur ? SLOTS.filter((s) => cur.plan[s] && !doneSlots(cur).includes(s)).map((s) => cur.plan[s]!) : [];
    return {
      meals, foods: foodMap, products: new Map(pd.map((p) => [p.foodId, p])), prefs: pr, satCap: targets(pf).satCap, stock: st,
      heldIds: held, recentMealIds: cur ? (SLOTS.map((s) => cur.plan[s]).filter(Boolean) as string[]) : [],
      costOf: (m: (typeof meals)[number]) => (m.bought ? m.bought.price : estCost.get(m.id) ?? 0),
    };
  };

  const saveWeek = (days: WeekPlan, weekOf: string) => {
    const row: Week = { weekOf, days, prepList: [] };
    const old = latest.current.weekRow;
    latest.current.weekRow = row;
    setWeekRow(row);
    void persist(db.put("week", row));
    if (old && old.weekOf !== weekOf) void persist(db.del("week", old.weekOf));
  };

  const nextSeven = () => Array.from({ length: 7 }, (_, i) => plus(new Date(), i + 1));

  /** Plan the next seven days (or re-deal the days not changed by hand). */
  const planTheWeek = useCallback(() => {
    const dates = nextSeven();
    const cur = latest.current.weekRow;
    const fresh = !cur || cur.weekOf !== dates[0];
    const existing = fresh ? undefined : (cur!.days as WeekPlan);
    const tonight: Record<string, Tonight> = {};
    for (const d of dates) { const t = (fresh ? undefined : cur!.days[d]?.tonight); if (t) tonight[d] = t; }
    saveWeek(planWeek({ ...weekInput(), dates, tonight, existing }).days, dates[0]);
  }, []);

  const tagNight = useCallback((d: string, t: Tonight) => {
    const cur = latest.current.weekRow;
    if (!cur) return;
    const days = tagTonight(cur.days as WeekPlan, d, t);
    // the tag changes that day's budget, so re-deal it (and any other unpinned day) from the new tags
    const tonight = Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.tonight]));
    saveWeek(planWeek({ ...weekInput(), dates: Object.keys(days).sort(), tonight, existing: days }).days, cur.weekOf);
  }, []);

  const swapWeek = useCallback((d: string, slot: Slot, dir: 1 | -1): boolean => {
    const cur = latest.current.weekRow;
    if (!cur) return false;
    const { stock: _s, heldIds: _h, recentMealIds: _r, costOf: _c, ...opts } = weekInput();
    const next = swapInWeek(cur.days as WeekPlan, d, slot, dir, opts);
    if (!next) return false;
    saveWeek(next, cur.weekOf);
    return true;
  }, []);

  /** Everything the planned week needs that the pantry can't cover, onto the shopping list. */
  const weekToList = useCallback((): number => {
    const cur = latest.current.weekRow;
    if (!cur) return 0;
    const { needs } = needsFor(cur.days as WeekPlan, weekInput());
    const before = latest.current.shopping;
    const next = addNeeds(before, needs, foodMap, "plan");
    const changed = next.filter((r) => { const o = before.find((x) => x.id === r.id); return !o || o.packs !== r.packs; });
    saveShopping(next);
    return changed.length;
  }, []);

  /** Finish Setup: preferences (and an optional medication) are saved and Setup isn't offered again. */
  const completeSetup = useCallback((next: Prefs, m: Med | null) => {
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
    if (m) {
      latest.current.med = m;
      setMed(m);
      void persist(db.put("meds", m));
    }
  }, []);

  const redoSetup = useCallback(() => {
    const next: Prefs = { ...latest.current.prefs, setupDone: false };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);

  const skipSetup = useCallback(() => {
    const next: Prefs = { ...latest.current.prefs, setupDone: true };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);

  /** Hide a meal ("not for me") or bring a hidden one back. */
  const setMealState = useCallback((mealId: string, state: "kept" | "hidden") => {
    const next: Prefs = { ...latest.current.prefs, meals: { ...latest.current.prefs.meals, [mealId]: { state } } };
    latest.current.prefs = next;
    setPrefs(next);
    void persist(db.put("prefs", next));
  }, []);

  /** Cards to show, in order: today's uneaten slots with a meal, or a near-miss meal for an empty slot. */
  const view = useMemo(() => {
    if (!day) return { cards: [] as { slot: Slot; mealId: string; nearMiss: boolean }[], empty: [] as Slot[] };
    const near = deal(optionsFor(day, budget, stock, prefs)).nearMiss;
    const cards: { slot: Slot; mealId: string; nearMiss: boolean }[] = [];
    const empty: Slot[] = [];
    for (const s of SLOTS) {
      if (doneSlots(day).includes(s)) continue;
      const id = day.plan[s];
      if (id) cards.push({ slot: s, mealId: id, nearMiss: false });
      else if (near[s]) cards.push({ slot: s, mealId: near[s]!.mealId, nearMiss: true });
      else empty.push(s);
    }
    return { cards, empty };
  }, [day, budget, stock, prefs, optionsFor]);

  return {
    ready, memoryOnly, profile, stock, day, answer, budget, carry, prefs, shopping, products: productByFood,
    med, allDays, labs, newMealIds: pendingMeals(meals.map((m) => m.id), prefs), week: (weekRow?.days ?? null) as WeekPlan | null, weekOf: weekRow?.weekOf ?? null,
    weekSummary: weekRow ? needsFor(weekRow.days as WeekPlan, weekInput()) : null,
    needsSetup: ready && !prefs.setupDone,
    needsCheckIn: ready && !day,
    cards: view.cards, emptySlots: view.empty,
    daySat: day ? planSat(day.plan) + overageOf(day) : 0,
    actions: {
      submitAnswer, swap, eat, undo, notFeelingIt, replaceSlot, undoReplaced, addExtra, removeExtra, toggleTablet, toggleWalk,
      addToList, addMealToList, setListItem, toggleChecked, removeFromList, restock, setStockGrams, setMealState, saveProfile, completeSetup, skipSetup, redoSetup, markBackedUp, dismissNudge, addOwnMeal, saveLabel, togglePrep, setSupperTonight, saveLab, deleteLab, decideNewMeal, planTheWeek, tagNight, swapWeek, weekToList,
      devScenario: import.meta.env.MODE === "single" ? devScenario : undefined,
    },
  };
}

