// How a day went, in one number and one colour, and what a week or month adds up to.
// Pure logic with tests. The point is a fair, explainable picture, not a verdict: every colour
// comes with the reasons, and a day is never marked down for something that wasn't recorded.
import type { Anchor, Day, Food, Meal, Med } from "./types";
import { mealNutrition } from "./nutrition";
import { extraNutrition, replacedNutrition } from "./offplan";

export type DayState = "none" | "partial" | "green" | "yellow" | "red";

/** The score is 100 points: saturated fat 40, soluble fibre 25, sodium 15, the four anchors 20. */
export const POINTS = { sat: 40, fibre: 25, sodium: 15, anchors: 20 } as const;
export const GREEN_AT = 75;
export const YELLOW_AT = 50;
/** Daytime goal for soluble fibre; supper isn't counted because its fibre isn't known. */
export const FIBRE_GOAL = 7;
/** What a normal supper is assumed to use when it wasn't logged. */
export const NORMAL_SUPPER = { sat: 7, na: 900 };
const SODIUM_MAX = 2000;
const ANCHORS: Anchor[] = ["betaGlucan", "legume", "nuts", "goodFat"];

export interface Supper {
  id: string;
  name: string;
  takeaway: boolean;
  sat: number;
  na: number;
}

export interface ScoreInput {
  day: Day;
  meals: Map<string, Meal>;
  foods: Map<string, Food>;
  /** Saturated-fat cap for a whole day, in grams. */
  satCap: number;
  /** Supper eaten that evening: it is recorded the next morning, so it's null until then. */
  supper: Supper | null;
  /** His medication, if set up: decides whether there's a tablet check to show. */
  med?: Pick<Med, "times"> | null;
}

export interface DayScore {
  state: DayState;
  /** 0–100, or null when nothing was recorded. */
  points: number | null;
  /** How many of the three daytime meals were recorded. */
  slots: number;
  /** With supper where it is recorded. */
  sat: number;
  satBudget: number;
  fibre: number;
  /** With supper where it is recorded. */
  sodium: number;
  /** The daytime meals (and anything swapped in or added) only, without supper. */
  daytimeSat: number;
  daytimeSodium: number;
  sodiumBudget: number;
  anchors: Anchor[];
  supper: Supper | null;
  /** Names of eaten meals by slot, for the day sheet. */
  eaten: { slot: string; mealId: string; name: string; emoji: string }[];
  meds: { taken: number; expected: number; done: boolean } | null;
  moved: boolean;
  /** Plain-words reasons, best first. */
  notes: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Saturated fat: full marks up to the budget, then falling away to nothing at 1.6× it. */
function satPoints(used: number, budget: number): number {
  const r = used / budget;
  if (r <= 1) return POINTS.sat;
  if (r <= 1.25) return POINTS.sat * (1 - ((r - 1) / 0.25) * 0.6);
  return clamp(POINTS.sat * 0.4 * ((1.6 - r) / 0.35), 0, POINTS.sat * 0.4);
}

export function scoreDay(i: ScoreInput): DayScore {
  const { day } = i;
  const eatenMeals = day.eaten.map((e) => ({ e, meal: i.meals.get(e.mealId) })).filter((x): x is { e: typeof x.e; meal: Meal } => !!x.meal);
  // A slot swapped for something else, or deliberately skipped, is still a recorded slot.
  const slots = new Set([...eatenMeals.map((x) => x.e.slot), ...(day.replaced ?? []).map((r) => r.slot)]).size;

  let sat = 0, na = 0, fibre = 0;
  const anchors = new Set<Anchor>();
  for (const { meal } of eatenMeals) {
    const n = mealNutrition(meal, i.foods);
    sat += n.sat; na += n.na; fibre += n.sol;
    for (const it of meal.items) for (const a of i.foods.get(it.foodId)?.anchors ?? []) anchors.add(a);
  }
  // Something else, or an extra, isn't in the library: use the rough estimate for what it was.
  // Food he picked from the food list brings its soluble fibre too; the rough guesses only know saturated fat and sodium.
  for (const r of day.replaced ?? []) { const n = replacedNutrition(r, i.foods); sat += n.sat; na += n.na; fibre += n.sol ?? 0; }
  for (const x of day.extras ?? []) { const n = extraNutrition(x, i.foods); sat += n.sat; na += n.na; fibre += n.sol ?? 0; }

  const withSupper = !!i.supper;
  const satBudget = withSupper ? i.satCap : Math.max(2.5, i.satCap - NORMAL_SUPPER.sat);
  const sodiumBudget = withSupper ? SODIUM_MAX : SODIUM_MAX - NORMAL_SUPPER.na;
  const satUsed = sat + (i.supper?.sat ?? 0);
  const naUsed = na + (i.supper?.na ?? 0);

  const doses = i.med?.times?.length ?? (i.med ? 1 : 0);
  const taken = day.dosesTaken?.length ?? (day.tabletAt ? 1 : 0);
  const meds = i.med ? { taken: Math.min(taken, doses), expected: doses, done: taken >= doses && doses > 0 } : null;
  const moved = !!day.walk;

  const base = { slots, sat: round1(satUsed), satBudget: round1(satBudget), fibre: round1(fibre), sodium: Math.round(naUsed), daytimeSat: round1(sat), daytimeSodium: Math.round(na), sodiumBudget, anchors: [...anchors], supper: i.supper, meds, moved,
    eaten: eatenMeals.map(({ e, meal }) => ({ slot: e.slot, mealId: meal.id, name: meal.name, emoji: meal.emoji })) };

  if (slots === 0) return { ...base, state: "none", points: null, notes: ["Nothing recorded for this day."] };

  const pSat = satPoints(satUsed, satBudget);
  const pFibre = clamp(fibre / FIBRE_GOAL, 0, 1) * POINTS.fibre;
  const rNa = naUsed / sodiumBudget;
  const pNa = rNa <= 1 ? POINTS.sodium : clamp(POINTS.sodium * (1 - (rNa - 1) / 0.5), 0, POINTS.sodium);
  const pAnch = anchors.size * (POINTS.anchors / ANCHORS.length);
  const points = Math.round(pSat + pFibre + pNa + pAnch);

  let state: DayState = points >= GREEN_AT ? "green" : points >= YELLOW_AT ? "yellow" : "red";
  // With fewer than two meals recorded we can't tell a good day from a missed log: never red or green.
  const partial = slots < 2;
  if (partial) state = "yellow";

  const notes: string[] = [];
  if (partial) notes.push("Only one meal was recorded, so this is a partial picture.");
  notes.push(satUsed <= satBudget ? `Saturated fat about ${round1(satUsed)} of ${round1(satBudget)} g.` : `Saturated fat about ${round1(satUsed)} g, over the ${round1(satBudget)} g budget.`);
  notes.push(fibre >= FIBRE_GOAL ? `Soluble fibre about ${round1(fibre)} g, goal met.` : `Soluble fibre about ${round1(fibre)} of ${FIBRE_GOAL} g.`);
  if (naUsed > sodiumBudget) notes.push(`Sodium about ${Math.round(naUsed / 10) * 10} mg, above ${sodiumBudget} mg.`);
  const missing = ANCHORS.filter((a) => !anchors.has(a));
  if (missing.length) notes.push(`Missed: ${missing.map((a) => ANCHOR_WORDS[a]).join(", ")}.`);
  for (const r of day.replaced ?? []) notes.push(r.size === "skipped" ? `${cap(r.slot)} was skipped.` : `${cap(r.slot)}: had ${r.what.toLowerCase()} instead.`);
  for (const x of day.extras ?? []) notes.push(`Extra: ${x.kind.toLowerCase()}.`);
  if (!withSupper) notes.push("Supper wasn't logged, so a normal one is assumed.");

  return { ...base, state, points, notes };
}

export const ANCHOR_WORDS: Record<Anchor, string> = { betaGlucan: "oats or barley", legume: "beans or lentils", nuts: "nuts or seeds", goodFat: "olive oil, avocado or oily fish" };
const round1 = (n: number) => Math.round(n * 10) / 10;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const STATE_WORDS: Record<DayState, string> = { none: "Nothing recorded", partial: "Partly recorded", green: "Went well", yellow: "Mixed", red: "A tough one" };
export const stateWord = (s: DayScore) => (s.state === "yellow" && s.slots < 2 ? STATE_WORDS.partial : STATE_WORDS[s.state]);

/* ── week and month summaries ───────────────────────────────── */

export interface PeriodSummary {
  days: number;
  recorded: number;
  counts: Record<DayState, number>;
  avgSat: number;
  avgFibre: number;
  avgSodium: number;
  anchorDays: Record<Anchor, number>;
  takeaways: number;
  medDays: { taken: number; expected: number } | null;
  movedDays: number;
  /** The meals that supplied the most saturated fat and sodium (names), most first. */
  topSat: string[];
  topSalty: string[];
  headline: string;
  suggestions: string[];
}

export function summarise(scores: DayScore[], meals: Map<string, Meal>, foods: Map<string, Food>, label: "week" | "month"): PeriodSummary {
  const rec = scores.filter((s) => s.state !== "none");
  // Averages leave out days with only one meal recorded: those are a missed log, not a light day.
  const full = rec.filter((s) => s.slots >= 2);
  const avgOver = full.length ? full : rec;
  const counts: Record<DayState, number> = { none: 0, partial: 0, green: 0, yellow: 0, red: 0 };
  for (const s of scores) counts[s.state] += 1;
  const avg = (f: (s: DayScore) => number) => (avgOver.length ? round1(avgOver.reduce((t, s) => t + f(s), 0) / avgOver.length) : 0);
  const anchorDays: Record<Anchor, number> = { betaGlucan: 0, legume: 0, nuts: 0, goodFat: 0 };
  for (const s of rec) for (const a of s.anchors) anchorDays[a] += 1;
  const takeaways = scores.filter((s) => s.supper?.takeaway).length;
  const withMed = scores.filter((s) => s.meds);
  const medDays = withMed.length ? { taken: withMed.filter((s) => s.meds!.done).length, expected: withMed.length } : null;

  const tally = (pick: (n: ReturnType<typeof mealNutrition>) => number) => {
    const by = new Map<string, number>();
    for (const s of rec) for (const e of s.eaten) {
      const m = meals.get(e.mealId);
      if (m) by.set(m.name, (by.get(m.name) ?? 0) + pick(mealNutrition(m, foods)));
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
  };
  const topSat = tally((n) => n.sat);
  const topSalty = tally((n) => n.na);

  // Like for like: the figures are described as daytime, so they leave supper out.
  const avgSat = avg((s) => s.daytimeSat), avgFibre = avg((s) => s.fibre), avgSodium = Math.round(avg((s) => s.daytimeSodium));
  const n = rec.length;
  const period = label === "week" ? "this week" : "this month";
  const headline = n === 0
    ? `Nothing recorded ${period} yet.`
    : `${counts.green} went well, ${counts.yellow} were mixed${counts.red ? `, ${counts.red} were tough` : ""}. ${n} of ${scores.length} days recorded.`;

  // Suggestions, most useful first, at most three. Medication comes before any food advice.
  const s: string[] = [];
  const moved = scores.filter((x) => x.moved).length;
  const satRatio = avgOver.length ? avgOver.reduce((t, x) => t + x.sat / x.satBudget, 0) / avgOver.length : 0;
  if (n < 3) {
    s.push("Record a few more days and this gets more useful.");
  } else {
    if (medDays && medDays.expected >= 3 && medDays.taken / medDays.expected < 0.8) s.push(`The tablet was ticked on ${medDays.taken} of ${medDays.expected} days. A calendar reminder at the same time each day usually fixes that.`);
    if (takeaways / Math.max(1, n) > 0.3) s.push(`${takeaways} takeaway ${takeaways === 1 ? "supper" : "suppers"} ${period}. They're the biggest reason for tough days, so a lean breakfast and lunch the next day helps.`);
    if (avgFibre < 4) s.push(`Soluble fibre averaged ${avgFibre} g against a ${FIBRE_GOAL} g daytime goal. The quickest lift is oat bran at breakfast or a teaspoon of psyllium before supper.`);
    if (anchorDays.legume / n < 0.4) s.push(`Beans, lentils or chickpeas showed up on ${anchorDays.legume} of ${n} days. Hummus counts, and they're cheap and filling at lunch.`);
    if (avgSodium > 1100 && topSalty.length) s.push(`Sodium is running high. The saltiest meals were ${topSalty.join(" and ")}; a squeeze of lemon or chilli can stand in for salt.`);
    if (satRatio > 0.95 && topSat.length) s.push(`Saturated fat is sitting right at the limit most days, mostly from ${topSat.join(" and ")}. A swap there moves the whole average.`);
    if (moved / scores.length < 0.4) s.push(`You moved on ${moved} of ${scores.length} days. Even ten minutes counts.`);
    if (!s.length) s.push("Nothing stands out to change. Keep doing what you're doing.");
  }
  return {
    days: scores.length, recorded: n, counts, avgSat, avgFibre, avgSodium, anchorDays, takeaways, medDays,
    movedDays: moved, topSat, topSalty, headline, suggestions: s.slice(0, 3),
  };
}
