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
  /** What's in one pack, in grams (ml are taken as grams): "NET 425 g" or "425 g e". */
  packG?: number;
}

export interface ParsedLabel extends LabelNumbers {
  /** Which printed column the numbers came from. */
  basis: "per100" | "unknown";
  /** The table says it is for the drained food (tinned fish, beans in brine). */
  drained: boolean;
  /** The pack says to rinse it. */
  rinse: boolean;
  /** Field names that were read, for the "we found N of 7" hint. */
  found: (keyof LabelNumbers)[];
}

const NUM = String.raw`(?:<\s*)?(\d+(?:[.,]\d+)?)`;
const toNum = (s: string) => Number(s.replace(",", "."));

/** The first number (in grams) after `label` on its line, ignoring any leading "<". */
function after(line: string, label: RegExp): number | undefined {
  const m = label.exec(line);
  if (!m) return undefined;
  // A unit printed in brackets after the name, "(g)", which OCR often reads as "(9".
  const rest = line.slice(m.index + m[0].length).replace(/^\s*[(\[]\s*(?:g|9|q|mg|m9|mq|rng)\s*[)\]]?/i, " ");
  const n = new RegExp(NUM).exec(rest);
  if (!n) return undefined;
  // Printed grams have one decimal. OCR often reads the "g" after "12.3 g" as a 9, giving 12.39.
  const raw = /^\d+[.,]\d9$/.test(n[1]) ? n[1].slice(0, -1) : n[1];
  return toNum(raw);
}

/** O/o that OCR read for 0 inside numbers, and l/I for 1. */
function clean(text: string): string {
  return text
    .replace(/[|]/g, " ")
    .replace(/(?<=\d)[Oo](?=\d|\b)/g, "0")
    .replace(/(?<=\d)[lI](?=\d)/g, "1")
    .replace(/ /g, " ");
}

export function parseLabel(text: string): ParsedLabel {
  const lines = clean(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: LabelNumbers = {};
  let kj: number | undefined;
  let salt: number | undefined;

  for (const line of lines) {
    const low = line.toLowerCase();
    // Energy with the unit in the heading: "Energy (kJ) 359 197". OCR often reads kJ as "kd".
    // The reader garbles both the word and the unit ("Eneray (ku)", "(kd)", "(ki)").
    if (/\ben[ea]r[gqa]\w*/.test(low) && kj === undefined && out.kcal === undefined) {
      const head = /en[ea]r[gqa]\w*\s*\(\s*(kcal|k[a-z\][1l|!]{1,2})\s*\)\s*:?\s*(\d+(?:[.,]\d+)?)/.exec(low);
      if (head) {
        if (head[1] === "kcal") out.kcal = toNum(head[2]);
        else kj = toNum(head[2]);
        continue;
      }
    }
    // Energy: "1050 kJ / 251 kcal" in either order, or one of them alone.
    if (/energy|energie|kilojoule|\bkj\b|kcal/.test(low) && (/kj/.test(low) || /kcal/.test(low))) {
      const kc = /(\d+(?:[.,]\d+)?)\s*kcal/.exec(low);
      const kjm = /(\d+(?:[.,]\d+)?)\s*kj/.exec(low);
      if (kc && out.kcal === undefined) out.kcal = toNum(kc[1]);
      if (kjm && kj === undefined) kj = toNum(kjm[1]);
      continue;
    }
    // "of which saturated" must be matched before total fat.
    if (/satur/.test(low) && out.sat === undefined) { out.sat = after(low, /satur\w*(?:\s*fat(?:ty acids)?)?/); continue; }
    if (/(mono|poly|trans)\s*-?\s*(unsat|fat)|unsaturated/.test(low)) continue;
    if (/\bfat\b|total fat|fat,? total/.test(low) && out.fat === undefined) { out.fat = after(low, /(?:total\s+)?\bfat\b(?:,?\s*total)?/); continue; }
    if (/sugar/.test(low) && out.sugar === undefined) { out.sugar = after(low, /sugars?/); continue; }
    if (/carbohydrate|carbs/.test(low) && out.carbs === undefined) { out.carbs = after(low, /(?:total\s+)?carbohydrates?|carbs/); continue; }
    if (/fib(re|er)/.test(low) && out.fibre === undefined) { out.fibre = after(low, /(?:dietary\s+)?fib(?:re|er)/); continue; }
    if (/protein/.test(low) && out.protein === undefined) { out.protein = after(low, /protein/); continue; }
    if (/sodium/.test(low) && out.sodium === undefined) {
      const mg = /sodium[^\d<]*(?:<\s*)?(\d+(?:[.,]\d+)?)\s*(mg|g)?/.exec(low);
      if (mg) out.sodium = mg[2] === "g" ? toNum(mg[1]) * 1000 : toNum(mg[1]);
      continue;
    }
    if (/\bsalt\b/.test(low) && salt === undefined) { salt = after(low, /\bsalt\b/); continue; }
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
  const hasBasis = /per\s*100\s*(g|ml)|100\s*(g|ml)/i.test(text);
  return { ...out, basis: hasBasis ? "per100" : "unknown", drained: /\bdrained\b/i.test(text), rinse: /\brins(e|ing)\b/i.test(text), found };
}
