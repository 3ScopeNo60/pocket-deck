// Reading a South African nutrition label from text: either what the phone's OCR returned or
// text pasted from the iPhone's Live Text. Tolerant of OCR noise, and never guesses silently:
// anything it couldn't find stays undefined so the confirm form shows it as blank.

export interface LabelNumbers {
  kcal?: number;
  protein?: number;
  carbs?: number;
  sugar?: number;
  fat?: number;
  sat?: number;
  fibre?: number;
  /** Milligrams per 100 g (or per 100 ml). */
  sodium?: number;
  /** Milligrams per 100 g. Few packs print these two. */
  cholesterol?: number;
  sterols?: number;
  /** What's in one pack, in grams (ml are taken as grams): "NET 425 g" or "425 g e". */
  packG?: number;
}

/** A serving as the label gives it: "1 tsp (5 g)" is { label: "1 tsp", g: 5 }; a bare "30 g" is "1 serving". */
export interface Serving { label: string; g: number }

export interface ParsedLabel extends LabelNumbers {
  /** Which printed column the numbers came from. */
  basis: "per100" | "unknown";
  /** The table says it is for the drained food (tinned fish, beans in brine). */
  drained: boolean;
  /** The pack says to rinse it. */
  rinse: boolean;
  /** The serving size, when the label gives one. */
  serving?: Serving;
  /** Field names that were read, for the "we found N of 7" hint. */
  found: (keyof LabelNumbers)[];
}

const toNum = (s: string) => Number(s.replace(/[ \u00a0]/g, "").replace(",", "."));

interface Num { v: number; unit?: "g" | "mg" }

/**
 * The numbers in a string, in order. A space inside a number is a thousands separator when one digit
 * leads and three follow ("1 650"), which is how SA labels print kJ and sodium; two-digit groups are
 * separate columns ("480 144"). A trailing g or mg is kept as the unit.
 */
function numbersIn(s: string): Num[] {
  const out: Num[] = [];
  for (const m of s.matchAll(/(?:<\s*)?(?<![\d.,])(\d[ \u00a0]\d{3}(?!\d)|\d+(?:[.,]\d+)?)(?:\s*(mg|g)\b)?/gi)) {
    out.push({ v: toNum(m[1]), unit: m[2] ? (m[2].toLowerCase() as "g" | "mg") : undefined });
  }
  return out;
}

/** A unit printed in brackets after a name, "(g)" or "(mg)", which OCR often reads as "(9" or "(rng". */
const HEAD_UNIT = /^\s*[(\[]\s*(g|9|q|mg|m9|mq|rng)\s*[)\]]?/i;
const headUnit = (u: string): "g" | "mg" => (/^(mg|m9|mq|rng)$/i.test(u) ? "mg" : "g");

/**
 * Which column is "per 100 g": 0 when it comes first, 1 when a per-serving column is printed before it.
 */
function per100Column(text: string): number {
  const i100 = text.search(/per\s*100\s*(g|ml)/i);
  // "Serving size: 1 tsp" on its own line is not a column; "per serving" and "per 30 g" are.
  const iServ = text.search(/per\s*(serving|portion)|per\s*(?!100\b)\d{1,3}\s*(g|ml)\b/i);
  return i100 >= 0 && iServ >= 0 && iServ < i100 ? 1 : 0;
}

/** The value in the per-100 g column after `label` on its line: its number and the unit, if any. */
function pick(line: string, label: RegExp, col: number): (Num & { head?: "g" | "mg" }) | undefined {
  const m = label.exec(line);
  if (!m) return undefined;
  let rest = line.slice(m.index + m[0].length);
  const hu = HEAD_UNIT.exec(rest);
  if (hu) rest = rest.slice(hu[0].length);
  const n = numbersIn(rest)[col];
  if (!n) return undefined;
  return { ...n, head: hu ? headUnit(hu[1]) : undefined };
}

/** Grams, with the "12.39" that OCR makes of "12.3 g" put right. */
function grams(line: string, label: RegExp, col: number): number | undefined {
  const n = pick(line, label, col);
  if (!n) return undefined;
  return !n.unit && /^[1-9]\d*\.\d9$/.test(String(n.v)) ? Number(String(n.v).slice(0, -1)) : n.v;
}

/** Sodium, cholesterol and sterols come in g or mg: take the unit from the number, else the heading, else guess from the size. */
function milligrams(line: string, label: RegExp, col: number, guessG: boolean): number | undefined {
  const n = pick(line, label, col);
  if (!n) return undefined;
  const unit = n.unit ?? n.head ?? (guessG && n.v < 10 && !Number.isInteger(n.v) ? "g" : "mg");
  return unit === "g" ? n.v * 1000 : n.v;
}

/** O/o that OCR read for 0 inside numbers, and l/I for 1. */
function clean(text: string): string {
  return text
    .replace(/[|]/g, " ")
    .replace(/(?<=\d)[Oo](?=\d|\b)/g, "0")
    .replace(/(?<=\d)[lI](?=\d)/g, "1")
    .replace(/ /g, " ");
}

export function parseLabel(text: string): ParsedLabel {
  const lines = clean(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const col = per100Column(text);
  const out: LabelNumbers = {};
  let kj: number | undefined;
  let salt: number | undefined;

  for (const line of lines) {
    const low = line.toLowerCase();
    // Energy with the unit in the heading: "Energy (kJ) 359 197". OCR often reads kJ as "kd".
    // The reader garbles both the word and the unit ("Eneray (ku)", "(kd)", "(ki)").
    if (/\ben[ea]r[gqa]\w*/.test(low) && kj === undefined && out.kcal === undefined) {
      const head = /en[ea]r[gqa]\w*\s*\(\s*(kcal|k[a-z\][1l|!]{1,2})\s*\)\s*:?/.exec(low);
      if (head) {
        const v = numbersIn(low.slice(head.index + head[0].length))[col]?.v;
        if (v !== undefined) {
          if (head[1] === "kcal") out.kcal = v;
          else kj = v;
        }
        continue;
      }
    }
    // Energy: "1050 kJ / 251 kcal" in either order, or one of them alone.
    if (/energy|energie|kilojoule|\bkj\b|kcal/.test(low) && (/kj/.test(low) || /kcal/.test(low))) {
      const kc = [...low.matchAll(/(\d[ \u00a0]\d{3}(?!\d)|\d+(?:[.,]\d+)?)\s*kcal/g)];
      const kjm = [...low.matchAll(/(\d[ \u00a0]\d{3}(?!\d)|\d+(?:[.,]\d+)?)\s*kj/g)];
      if (kc[col] && out.kcal === undefined) out.kcal = toNum(kc[col][1]);
      if (kjm[col] && kj === undefined) kj = toNum(kjm[col][1]);
      continue;
    }
    // Mono-, poly- and trans fats and "unsaturated" are not saturated fat, so skip them first.
    if (/(mono|poly|trans)\s*-?\s*(unsat|fat)|unsaturated/.test(low)) continue;
    // "of which saturated" must be matched before total fat.
    if (/satur/.test(low) && out.sat === undefined) { out.sat = grams(low, /satur\w*(?:\s*fat(?:ty acids)?)?/, col); continue; }
    if (/\bfat\b|total fat|fat,? total/.test(low) && out.fat === undefined) { out.fat = grams(low, /(?:total\s+)?\bfat\b(?:,?\s*total)?/, col); continue; }
    if (/sugar/.test(low) && out.sugar === undefined) { out.sugar = grams(low, /sugars?/, col); continue; }
    if (/carbohydrate|carbs/.test(low) && out.carbs === undefined) { out.carbs = grams(low, /(?:total\s+)?carbohydrates?|carbs/, col); continue; }
    if (/fib(re|er)/.test(low) && out.fibre === undefined) { out.fibre = grams(low, /(?:dietary\s+)?fib(?:re|er)/, col); continue; }
    if (/protein/.test(low) && out.protein === undefined) { out.protein = grams(low, /protein/, col); continue; }
    if (/sodium/.test(low) && out.sodium === undefined) { out.sodium = milligrams(low, /sodium/, col, true); continue; }
    if (/(?<!chole)sterol|stanol/.test(low) && out.sterols === undefined) { out.sterols = milligrams(low, /(?:(?<!chole)sterol|stanol)s?/, col, true); continue; }
    if (/cholesterol/.test(low) && out.cholesterol === undefined) { out.cholesterol = milligrams(low, /cholesterol/, col, false); continue; }
    if (/\bsalt\b/.test(low) && salt === undefined) { salt = grams(low, /\bsalt\b/, col); continue; }
  }

  // Energy given only in kJ.
  if (out.kcal === undefined && kj !== undefined) out.kcal = Math.round(kj / 4.184);
  // Many labels print salt, not sodium: sodium is salt / 2.5.
  if (out.sodium === undefined && salt !== undefined) out.sodium = Math.round((salt / 2.5) * 1000);

  // Pack size: "Net weight 425 g", "Contents: 1 kg", or the e-mark ("425 g e" / "425g ℮").
  const net = /net\s*(?:weight|wt\.?|content|contents|mass|volume)?\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i.exec(text)
    ?? /\bcontents?\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i.exec(text)
    ?? /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\s*[e\u212e]\b/i.exec(text);
  if (net) {
    const n = toNum(net[1]) * (/^(kg|l)$/i.test(net[2]) ? 1000 : 1);
    if (n > 0 && n <= 20000) out.packG = Math.round(n);
  }

  const found = (Object.keys(out) as (keyof LabelNumbers)[]).filter((k) => out[k] !== undefined);
  const serving = parseServing(text);
  const hasBasis = /per\s*100\s*(g|ml)|(?<!\d)100\s*(g|ml)/i.test(text);
  return { ...out, basis: hasBasis ? "per100" : "unknown", drained: /\bdrained\b/i.test(text), rinse: /\brins(e|ing)\b/i.test(text), ...(serving ? { serving } : {}), found };
}

const UNITS: Record<string, string> = { tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", cup: "cup", cups: "cup", scoop: "scoop", scoops: "scoop", slice: "slice", slices: "slice", biscuit: "biscuit", biscuits: "biscuit", piece: "piece", pieces: "piece" };
const FRACTION: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

/**
 * The serving size: a household measure with its weight ("Serving size: 1 tbsp (10 g)", "2 tsp (10g)"),
 * else just a weight ("Serving size 30 g", "per 30 g serving", "per serving (30 g)"). Several of a unit are
 * brought down to one ("2 tbsp (30 g)" is 1 tbsp = 15 g).
 */
export function parseServing(text: string): Serving | undefined {
  const m = /(\d+(?:[.,]\d+)?|[½¼¾])?\s*(tsp|teaspoons?|tbsp|tablespoons?|cups?|scoops?|slices?|biscuits?|pieces?)\b\.?\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i.exec(text);
  if (m) {
    const count = m[1] ? (FRACTION[m[1]] ?? toNum(m[1])) : 1;
    const g = toNum(m[3]);
    if (count > 0 && g > 0 && g / count <= 500) return { label: `1 ${UNITS[m[2].toLowerCase()]}`, g: Math.round((g / count) * 100) / 100 };
  }
  const grams = /serving\s*size\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g\b/i.exec(text)
    ?? /per\s*(\d+(?:[.,]\d+)?)\s*g\s*(?:single\s*)?serving/i.exec(text)
    ?? /per\s*serving\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i.exec(text);
  if (grams) {
    const g = toNum(grams[1]);
    if (g > 0 && g <= 500 && g !== 100) return { label: "1 serving", g };
  }
  return undefined;
}
