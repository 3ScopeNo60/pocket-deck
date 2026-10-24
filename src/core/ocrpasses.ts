// Reading a label can take more than one try. Each pass is another way of looking at the same
// photo. Numbers from all passes are merged field by field, and we stop at the first point where
// energy, saturated fat and sodium are all there and the energy fits the other numbers.
import { parseLabel, type LabelNumbers, type ParsedLabel } from "./label";

const REQUIRED = ["kcal", "sat", "sodium"] as const;

export interface MergedLabel extends ParsedLabel {
  /** Energy was read but doesn't fit the protein, carbohydrate and fat beside it. */
  suspectEnergy: boolean;
}

/** Energy from the macros (Atwater). Null when any of the three is missing. */
function expectedKcal(n: LabelNumbers): number | null {
  if (n.protein === undefined || n.carbs === undefined || n.fat === undefined) return null;
  return 4 * n.protein + 4 * n.carbs + 9 * n.fat;
}

function fits(kcal: number, expected: number | null): boolean {
  return expected === null || Math.abs(kcal - expected) <= Math.max(15, 0.3 * expected);
}

/**
 * The best reading of a label from several passes of the same photo. Earlier passes win, later ones
 * fill gaps, with two corrections for what OCR gets wrong: a dropped decimal point ("174" for "17.4")
 * gives way to the same digits with one, and energy that doesn't fit the macros gives way to one that does.
 */
export function mergeReads(texts: string[]): MergedLabel {
  const reads = texts.map((t) => parseLabel(t));
  const keys = ["protein", "carbs", "sugar", "fat", "sat", "fibre", "sodium", "cholesterol", "sterols", "packG"] as const;
  const out: LabelNumbers = {};
  for (const k of keys) {
    const vals = reads.map((r) => r[k]).filter((v): v is number => v !== undefined);
    if (!vals.length) continue;
    let pick = vals[0];
    // Grams are printed with one decimal; a lost point turns 1.3 into 13 and 17.4 into 174.
    if (k !== "sodium" && k !== "packG" && k !== "cholesterol" && k !== "sterols") {
      const smaller = vals.find((v) => v > 0 && Math.abs(pick - v * 10) < 1e-9);
      if (smaller !== undefined) pick = smaller;
    }
    out[k] = pick;
  }
  const expected = expectedKcal(out);
  const kcals = reads.map((r) => r.kcal).filter((v): v is number => v !== undefined);
  let suspectEnergy = false;
  if (kcals.length) {
    const good = kcals.find((k) => fits(k, expected));
    out.kcal = good ?? kcals[0];
    suspectEnergy = good === undefined;
  }
  const found = (Object.keys(out) as (keyof LabelNumbers)[]).filter((k) => out[k] !== undefined);
  return {
    ...out,
    basis: reads.some((r) => r.basis === "per100") ? "per100" : "unknown",
    drained: reads.some((r) => r.drained),
    rinse: reads.some((r) => r.rinse),
    serving: reads.find((r) => r.serving)?.serving,
    found,
    suspectEnergy,
  };
}

export function isComplete(texts: string[]): boolean {
  const m = mergeReads(texts);
  return REQUIRED.every((k) => m[k] !== undefined) && !m.suspectEnergy;
}

export async function readUntilComplete(
  passes: (() => Promise<string>)[],
  onAttempt?: (attempt: number, of: number) => void,
): Promise<{ texts: string[]; attempts: number; complete: boolean }> {
  const texts: string[] = [];
  let attempts = 0;
  for (let i = 0; i < passes.length; i++) {
    onAttempt?.(i + 1, passes.length);
    attempts = i + 1;
    try {
      texts.push(await passes[i]());
    } catch (e) {
      if (i === 0) throw e; // nothing read at all: let the caller say so
      break;
    }
    if (isComplete(texts)) return { texts, attempts, complete: true };
  }
  return { texts, attempts, complete: isComplete(texts) };
}
