// An online grocery order, read from the cart or order screen (pasted text, or a screenshot read
// by OCR): which products, how many, what size, what it cost. Then each line is matched to a
// food in the list so one tap can restock the pantry with real pack sizes and prices.
import type { Food } from "./types";

export interface OrderLine {
  /** What the line said, cleaned a little. */
  name: string;
  /** Grams (or ml) in one pack, from the name: "…Tuna In Water 170g". */
  packG?: number;
  /** Packs supplied. */
  qty: number;
  /** The line's price for all of its packs, in rand. */
  total?: number;
}

const NOISE = /(^|\b)(view products|close|sub-?total|delivery|service fee|order total|total due)\b|\b\d+\s*min\b|\b\d+\s*items?\b/i;
const QTY = /qty:?\s*(\d+)\s*\/\s*(\d+)/i;
const PRICE_END = /(?:^|\s)R?\s*(\d{1,4}[.,]\d{2})\s*$/;
const PRICE_ONLY = /^R?\s*(\d{1,4}[.,]\d{2})$/;
const SIZE = /(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l)\b/gi;

const num = (s: string) => Number(s.replace(",", "."));

/** Leading scraps OCR makes of product pictures ("EEA", "2ats.", "&") are dropped from a line. */
function tidy(line: string): string {
  let t = line.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  for (;;) {
    const m = /^(\S+)\s+(.*)$/.exec(t);
    if (!m) break;
    const w = m[1];
    const junk = !/[a-z]{4,}/i.test(w) && !/^\d+(?:[.,]\d+)?\s?(kg|g|ml|l)$/i.test(w) && !/^(the|and|in|of|per|pnp)$/i.test(w) && w.length <= 5 && !/^[A-Z][a-z]+$/.test(w);
    if (!junk) break;
    t = m[2];
  }
  return t;
}

export function parseOrder(text: string): OrderLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !NOISE.test(l));
  const out: OrderLine[] = [];
  let block: string[] = [];
  let price: number | undefined;
  // Prices standing alone since the last Qty line. When a screenshot is read as columns, the right-hand
  // column of prices comes out as a run at the end, in the order of the items.
  let stray: number[] = [];
  for (const raw of lines) {
    const q = QTY.exec(raw);
    const only = PRICE_ONLY.exec(raw);
    if (only && block.length === 0 && out.length && out[out.length - 1].total === undefined) {
      out[out.length - 1].total = num(only[1]); // the price came after its Qty line
      continue;
    }
    let line = raw;
    if (q) line = raw.slice(0, q.index).trim();
    const p = PRICE_END.exec(line);
    if (PRICE_ONLY.test(line)) { price = num(line.replace(/^R/i, "")); stray.push(price); line = ""; }
    else if (p) { price = num(p[1]); line = line.slice(0, p.index).trim(); }
    if (line) block.push(tidy(line));
    if (q) {
      stray = [];
      const qty = Number(q[1]);
      const name = block.filter(Boolean).join(" ").replace(/\bper\s*kg\b/gi, "").replace(/\s+/g, " ").trim();
      if (name && qty > 0) {
        let packG: number | undefined;
        for (const m of name.matchAll(SIZE)) packG = Math.round(num(m[1]) * (/^(kg|l)$/i.test(m[2]) ? 1000 : 1));
        // A multipack, "6 x 410g": the whole pack is every tin in it.
        const multi = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l)\b/i.exec(name);
        if (multi) packG = Math.round(Number(multi[1]) * num(multi[2]) * (/^(kg|l)$/i.test(multi[3]) ? 1000 : 1));
        out.push({ name, packG, qty, total: price });
      }
      block = [];
      price = undefined;
    }
  }
  const missing = out.filter((l) => l.total === undefined);
  if (missing.length && stray.length >= missing.length) missing.forEach((l, i) => { l.total = stray[i]; });
  return out;
}

/* ── matching a line to a food ─────────────────────────────── */

const STOP = new Set(["checkers", "housebrand", "house", "brand", "pnp", "woolworths", "fresh", "per", "kg", "and", "in", "with", "the", "of", "pack", "packed", "light", "meat", "shredded", "chunks", "flakes", "wholegrain", "whole", "grain", "long", "boneless", "raw", "organic", "free", "range", "range", "premium", "farmer", "choice", "farmers", "padkos", "tastic", "saikav", "clover", "full", "cream"]);
/** Words in a food's name that describe how it's prepared rather than what it is. "Low-fat" and "unsweetened" are not here: they change the numbers, so a line must say them. */
const QUALIFIER = new Set(["cooked", "rinsed", "grilled", "tinned", "plain", "skinless", "baby", "mixed", "ground", "frozen", "100", "peanuts", "husk", "seeds", "stir", "fry", "veg"]);
const ALIASES: [RegExp, string][] = [
  [/chick\s*peas?/g, "chickpea"],
  [/low[\s-]?fat/g, "lowfat"],
  [/\bpeanut\s+butter\b/g, "peanut butter"],
  [/\bnon[\s-]?fat\b/g, "lowfat"],
];

function tokens(s: string): string[] {
  let t = s.toLowerCase().replace(/['’]/g, "").replace(/\([^)]*\)/g, " ");
  for (const [re, to] of ALIASES) t = t.replace(re, to);
  return t.split(/[^a-z0-9]+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/** Words that mean a product is a made or processed thing that merely contains a food's name. */
const PROCESSED = new Set(["juice", "sauce", "bread", "cake", "noodle", "chip", "crisp", "cider", "chocolate", "biscuit", "cookie", "rusk", "cereal", "flavoured", "flavour", "drink", "sweet", "candy", "jam", "pie", "pizza", "roll", "ring", "soup", "stew", "dressing", "mayonnaise", "mayo", "ketchup", "chutney", "crumbed", "nugget", "polony", "sausage", "burger", "patty", "finger", "ice", "yoghurt", "yogurt", "muffin", "bar", "spray", "pickled", "pickle", "relish", "paste", "puree", "smoothie", "syrup", "wine", "beer", "tea", "coffee", "shake", "cracker", "pasta", "rice", "pudding", "dessert", "custard", "kit", "bake", "wrap", "salad", "sandwich", "toast"]);

/**
 * Tinned foods are stocked by their drained weight: a 170 g tin of tuna is about 120 g of fish. For a
 * food whose numbers are for drained solids and a printed weight above its biggest pack, the weight
 * the app should stock (its nearest pack size to 65 % of the tin) and a note saying so; else null.
 */
export function drainedPack(food: Food, printedG: number): { packG: number; note: string } | null {
  const sizes = food.packSizes;
  if (!/drained/i.test(food.source) || printedG <= Math.max(...sizes) * 1.1) return null;
  const target = printedG * 0.65;
  const packG = sizes.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  return { packG, note: `${printedG} g tin, about ${packG} g drained` };
}

export interface Match {
  food: Food;
  packG: number;
  /** A word in the line that says it is a different, processed product: the match is only a suggestion. */
  unsure?: string;
  /** Shown beside the line when the tin's weight was turned into the food's drained one. */
  note?: string;
}

/** The food a line most likely is, or null. Every distinguishing word of the food must appear in the line. */
export function matchLine(line: OrderLine, foods: Food[]): Match | null {
  const lineTok = new Set(tokens(line.name));
  let best: { food: Food; score: number } | null = null;
  for (const f of foods) {
    const ft = tokens(f.name).filter((w) => !STOP.has(w));
    const must = ft.filter((w) => !QUALIFIER.has(w));
    if (must.length === 0 || !must.every((w) => lineTok.has(w))) continue;
    const score = must.length * 3 + ft.filter((w) => QUALIFIER.has(w) && lineTok.has(w)).length;
    if (!best || score > best.score) best = { food: f, score };
  }
  if (!best) return null;
  const { food } = best;
  const foodTok = new Set(tokens(food.name));
  const unsure = [...lineTok].find((w) => PROCESSED.has(w) && !foodTok.has(w));
  const sizes = food.packSizes;
  const d = line.packG ? drainedPack(food, line.packG) : null;
  return { food, packG: d?.packG ?? line.packG ?? sizes[0], note: d?.note, unsure };
}
