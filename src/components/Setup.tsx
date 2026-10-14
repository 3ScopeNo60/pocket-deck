import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { foods, meals, startingMealIds } from "../core/content";
import { buildIcs } from "../core/ics";
import { FLAVOURS, anchorGaps, applySetup, foodsToSwipe, mealsToSwipe, startingFoodAnswers, type FoodAnswer } from "../core/setup";
import type { Med, Prefs, Profile } from "../core/types";
import { foodMap } from "../app/viewModel";
import { Me } from "./Me";
import { SwipeStack, type Dir, type SwipeAction } from "./SwipeStack";
import { TimeWheel, mergeTime } from "./TimeWheel";

type Step = "welcome" | "about" | "flavours" | "foods" | "meals" | "gaps" | "meds" | "reminders" | "done";
const ORDER: Step[] = ["welcome", "about", "flavours", "foods", "meals", "gaps", "meds", "reminders", "done"];

const FOOD_ACTIONS: SwipeAction[] = [
  { dir: "left", label: "Not for me", emoji: "✕", stamp: "NOPE" },
  { dir: "up", label: "Willing to try", emoji: "★", stamp: "TRY IT" },
  { dir: "right", label: "Like it", emoji: "♥", stamp: "LIKE" },
];
const MEAL_ACTIONS: SwipeAction[] = [
  { dir: "left", label: "Not for me", emoji: "✕", stamp: "SKIP" },
  { dir: "right", label: "Keep it", emoji: "✓", stamp: "KEEP" },
];
const FOOD_ANSWER: Record<Dir, FoodAnswer> = { left: "no", up: "try", right: "like" };

interface Props {
  profile: Profile;
  prefs: Prefs;
  onSaveProfile: (p: Profile) => void;
  onAddToList: (foodId: string) => void;
  onFinish: (prefs: Prefs, med: Med | null) => void;
  onSkip: () => void;
}

const SLIDE = {
  in: (d: number) => ({ opacity: 0, x: 24 * d }),
  center: { opacity: 1, x: 0 },
  out: (d: number) => ({ opacity: 0, x: -24 * d }),
};

/** A few minutes, once. Everything here can be changed later under Me and Kitchen. */
export function Setup({ profile, prefs, onSaveProfile, onAddToList, onFinish, onSkip }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [flavours, setFlavours] = useState<string[]>([]);
  const starting = useMemo(() => startingFoodAnswers(meals, startingMealIds), []);
  const [answers, setAnswers] = useState<Record<string, FoodAnswer>>(starting);
  const foodDeck = useMemo(() => foodsToSwipe(foods, meals, 40, new Set(Object.keys(starting))), [starting]);
  const [fi, setFi] = useState(0);
  const [mealDeck, setMealDeck] = useState<typeof meals>([]);
  const [mi, setMi] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [med, setMed] = useState({ name: "", dose: "", pack: "", per: 1, n: 1, times: ["20:00", "08:00", "14:00"], at: 0 });

  const gaps = useMemo(() => anchorGaps(foods, answers), [answers]);
  /** 1 when moving on, -1 when going back: the screen slides in from the side you came from. */
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (s: Step, d: 1 | -1 = 1) => { setDir(d); setStep(s); window.scrollTo({ top: 0 }); };
  const skipGaps = (s: Step): Step => (s === "gaps" && gaps.length === 0 ? "meds" : s);
  const after = (s: Step): Step => skipGaps(ORDER[ORDER.indexOf(s) + 1]);
  const before = (s: Step): Step => { const p = ORDER[Math.max(1, ORDER.indexOf(s) - 1)]; return p === "gaps" && gaps.length === 0 ? "meals" : p; };

  const doseTimes = [...med.times.slice(0, med.n)].sort();
  const medRow: Med | null = med.name.trim()
    ? {
        id: "med-1", name: med.name.trim(), dose: med.dose.trim(), time: doseTimes[0], times: doseTimes, perDose: med.per,
        packSize: Number(med.pack) || 0, pillsLeft: Number(med.pack) || 0, takenLog: [],
      }
    : null;

  function startMeals() {
    setMealDeck(mealsToSwipe(meals, answers, flavours, startingMealIds).slice(0, 20));
    setMi(0);
    go("meals");
  }

  function downloadCalendar() {
    try {
      const ics = buildIcs({ planTime: "18:00", snackTime: "16:30", tabletTimes: medRow?.times, start: new Date() });
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "pocket-deck-reminders.ics" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Open the file to add them to Calendar");
    } catch {
      toast("This view can't save files. It works in the installed app.");
    }
  }

  const goBack = () => {
    const target = before(step);
    if (target === "foods") setFi(Math.max(0, foodDeck.length - 1));
    if (target === "meals") setMi(Math.max(0, mealDeck.length - 1));
    go(target, -1);
  };
  const previousFood = () => setFi((i) => Math.max(0, i - 1));
  const previousMeal = () => {
    const back = mealDeck[mi - 1];
    if (!back) return;
    setKept((k) => k.filter((x) => x !== back.id));
    setSkipped((k) => k.filter((x) => x !== back.id));
    setMi(mi - 1);
  };

  const finish = () => onFinish(applySetup(prefs, { flavours, foods: answers, keptMeals: kept, skippedMeals: skipped }), medRow);
  const food = foodDeck[fi];
  const meal = mealDeck[mi];
  const swipeStep = step === "foods" || step === "meals";

  return (
    <div className="setup">
      {step !== "welcome" && step !== "done" && (
        <div className="setup-top">
          <button className="link setup-back" onClick={goBack}>Back</button>
          {step === "foods" && <span className="setup-count">{Math.min(fi + 1, foodDeck.length)} of {foodDeck.length}</span>}
          {step === "meals" && <span className="setup-count">Meals · {Math.min(mi + 1, mealDeck.length)} of {mealDeck.length}</span>}
        </div>
      )}
      {swipeStep && (
        <div className="setup-progress" aria-hidden="true">
          <span style={{ width: `${(100 * (step === "foods" ? fi : mi)) / Math.max(1, step === "foods" ? foodDeck.length : mealDeck.length)}%` }} />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={step} className={swipeStep ? "setup-step swipe-step" : "setup-step"}
          custom={dir} variants={SLIDE} initial="in" animate="center" exit="out" transition={{ duration: 0.2 }}>

          {step === "welcome" && (
            <>
              <div className="setup-body center">
                <div className="setup-hero"><span className="emoji">🥣</span></div>
                <h1 className="setup-title">Let's set up your days</h1>
                <p className="setup-lede">A few minutes, once. I'll ask about you, what you like to eat, and what you take. Everything stays on this phone.</p>
              </div>
              <div className="setup-actions">
                <motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={() => go("about")}>Let's go</motion.button>
                <button className="btn ghost wide" onClick={onSkip}>Skip for now</button>
              </div>
            </>
          )}

          {step === "about" && (
            <div className="setup-body">
              <h1 className="setup-title">About you</h1>
              <p className="setup-lede">So your daily limits are yours and not a guess.</p>
              <Me embedded profile={profile} onSave={(p) => { onSaveProfile(p); go("flavours"); }} />
            </div>
          )}

          {step === "flavours" && (
            <>
              <div className="setup-body center">
                <h1 className="setup-title">What do you enjoy?</h1>
                <p className="setup-lede">Pick any. Plain food gets boring fast, so these steer which meals I suggest first.</p>
                <div className="flavour-grid">
                  {FLAVOURS.map((f) => (
                    <motion.button key={f.key} className="flavour" aria-pressed={flavours.includes(f.key)} whileTap={{ scale: 0.95 }}
                      onClick={() => setFlavours(flavours.includes(f.key) ? flavours.filter((x) => x !== f.key) : [...flavours, f.key])}>
                      <span className="emoji">{f.emoji}</span>{f.label}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="setup-actions"><motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={() => go("foods")}>{flavours.length ? "Next" : "None of these"}</motion.button></div>
            </>
          )}

          {step === "foods" && (food ? (
            <SwipeStack
              key={food.id}
              id={food.id}
              actions={FOOD_ACTIONS}
              onPrevious={previousFood}
              canPrevious={fi > 0}
              onDecide={(d) => {
                setAnswers((a) => ({ ...a, [food.id]: FOOD_ANSWER[d] }));
                if (fi + 1 >= foodDeck.length) startMeals(); else setFi(fi + 1);
              }}
            >
              <div className="swipe-face">
                <div className="icon-tile huge"><span className="emoji">{food.emoji}</span></div>
                <h2 className="swipe-name">{food.name}</h2>
                <p className="swipe-hint">Swipe right to like, left to skip, up if you'd try it</p>
              </div>
            </SwipeStack>
          ) : (
            <div className="setup-actions"><button className="btn wide" onClick={startMeals}>Next</button></div>
          ))}

          {step === "meals" && (meal ? (
            <SwipeStack
              key={meal.id}
              id={meal.id}
              actions={MEAL_ACTIONS}
              onPrevious={previousMeal}
              canPrevious={mi > 0}
              onDecide={(d) => {
                if (d === "right") setKept((s) => [...s, meal.id]); else setSkipped((s) => [...s, meal.id]);
                if (mi + 1 >= mealDeck.length) go(after("meals")); else setMi(mi + 1);
              }}
            >
              <div className="swipe-face meal">
                <div className="title"><div className="icon-tile"><span className="emoji">{meal.emoji}</span></div><h2 className="name">{meal.name}</h2></div>
                <div className="tags">{meal.tags.map((t) => <span key={t} className="tag">{t}</span>)}<span className="tag">{meal.cuisine}</span></div>
                <ul className="items">
                  {meal.items.map((i) => (
                    <li key={i.foodId} className="item"><span className="emoji">{foodMap.get(i.foodId)?.emoji}</span><span className="what">{foodMap.get(i.foodId)?.name}</span><span className="pill">{i.measure}</span></li>
                  ))}
                </ul>
              </div>
            </SwipeStack>
          ) : (
            <>
              <div className="setup-body center"><h1 className="setup-title">Nothing new to show</h1></div>
              <div className="setup-actions"><button className="btn wide" onClick={() => go(after("meals"))}>Next</button></div>
            </>
          ))}

          {step === "gaps" && (
            <>
              <div className="setup-body center">
                <h1 className="setup-title">One thing worth a thought</h1>
                {gaps.map((g) => (
                  <div key={g.anchor} className="setup-card">
                    <p className="setup-lede">You've ruled out all the {g.what}. They do a lot of the work for your cholesterol, so here are easier ways in:</p>
                    {g.routes.map((id) => (
                      <div key={id} className="krow static">
                        <span className="emoji">{foodMap.get(id)?.emoji}</span>
                        <span className="kname">{foodMap.get(id)?.name}</span>
                        <button className="btn small" onClick={() => { setAnswers((a) => ({ ...a, [id]: "try" })); onAddToList(id); toast(`${foodMap.get(id)?.name} is on your list`); }}>Try it</button>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="k-sub">If none appeal, that's fine. I'll lean on the other foods and won't bring it up again.</p>
              </div>
              <div className="setup-actions"><motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={() => go(after("gaps"))}>Carry on</motion.button></div>
            </>
          )}

          {step === "meds" && (
            <>
              <div className="setup-body center">
                <h1 className="setup-title">Your medication</h1>
                <p className="setup-lede">Optional. It adds a daily tick and a refill countdown. Use the name on the box once you have it.</p>
                <label className="me-field"><span className="me-label">Name</span><span className="me-input"><input value={med.name} placeholder="As printed on the box" onChange={(e) => setMed({ ...med, name: e.target.value })} aria-label="Medication name" /></span></label>
                <div className="me-grid two">
                  <label className="me-field"><span className="me-label">Strength</span><span className="me-input"><input value={med.dose} placeholder="20 mg" onChange={(e) => setMed({ ...med, dose: e.target.value })} aria-label="Strength" /></span></label>
                  <label className="me-field"><span className="me-label">Tablets in a pack</span><span className="me-input"><input inputMode="numeric" value={med.pack} placeholder="30" onChange={(e) => setMed({ ...med, pack: e.target.value.replace(/\D/g, "") })} aria-label="Tablets in a pack" /></span></label>
                </div>
                <div className="me-field">
                  <span className="me-label">Tablets each time</span>
                  <div className="stepper wide" role="group" aria-label="Tablets each time">
                    <button aria-label="One fewer tablet" onClick={() => setMed((m) => ({ ...m, per: Math.max(1, m.per - 1) }))}>−</button>
                    <b>{med.per}</b>
                    <button aria-label="One more tablet" onClick={() => setMed((m) => ({ ...m, per: Math.min(4, m.per + 1) }))}>+</button>
                  </div>
                </div>
                <div className="me-field">
                  <span className="me-label">Times a day</span>
                  <div className="seg seg-3" role="group" aria-label="Times a day">
                    {[1, 2, 3].map((n) => (
                      <button key={n} aria-pressed={med.n === n} onClick={() => setMed((m) => ({ ...m, n, at: Math.min(m.at, n - 1), times: n === 1 ? ["20:00"] : n === 2 ? ["08:00", "20:00"] : ["08:00", "14:00", "20:00"] }))}>{n === 1 ? "Once" : n === 2 ? "Twice" : "Three"}</button>
                    ))}
                  </div>
                </div>
                <div className="me-field">
                  {med.n > 1 ? (
                    <div className="chips" role="group" aria-label="Which dose">
                      {med.times.slice(0, med.n).map((t, i) => (
                        <button key={i} className="chip" aria-pressed={med.at === i} onClick={() => setMed((m) => ({ ...m, at: i }))}>{["First", "Second", "Third"][i]} · {t}</button>
                      ))}
                    </div>
                  ) : (
                    <span className="me-label">Time you take it · {med.times[0]}</span>
                  )}
                  <TimeWheel key={med.at} value={med.times[med.at]} onChange={(part) => setMed((m) => ({ ...m, times: m.times.map((t, i) => (i === m.at ? mergeTime(t, part) : t)) }))} />
                </div>
              </div>
              <div className="setup-actions">
                <motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={() => go(after("meds"))}>{medRow ? "Save and continue" : "Skip for now"}</motion.button>
              </div>
            </>
          )}

          {step === "reminders" && (
            <>
              <div className="setup-body center">
                <h1 className="setup-title">Gentle reminders</h1>
                <p className="setup-lede">Your Calendar does the reminding, so it works even when this app is closed:</p>
                <div className="krow static"><span className="emoji">🗓️</span><span className="kname">Plan your week<small>Sundays at 18:00</small></span></div>
                <div className="krow static"><span className="emoji">🍎</span><span className="kname">Fibre snack<small>Every day at 16:30</small></span></div>
                {medRow && <div className="krow static"><span className="emoji">💊</span><span className="kname">{medRow.name}<small>{medRow.perDose && medRow.perDose > 1 ? `${medRow.perDose} tablets · ` : ""}{doseTimes.length > 1 ? `${doseTimes.length} times a day at ${doseTimes.join(" and ")}` : `Every day at ${doseTimes[0]}`}</small></span></div>}
              </div>
              <div className="setup-actions">
                <motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={downloadCalendar}>Add to Calendar</motion.button>
                <button className="btn ghost wide" onClick={() => go(after("reminders"))}>Not now</button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div className="setup-body center">
                <div className="setup-hero"><span className="emoji">✨</span></div>
                <h1 className="setup-title">You're set</h1>
                <p className="setup-lede">
                  {kept.length ? `${kept.length} new meal${kept.length === 1 ? "" : "s"} added to your rotation. ` : ""}
                  Change anything later under Me, or hide a meal from Kitchen. Your data lives only on this phone, so back it up from Me (Back up and restore) now and then.
                </p>
              </div>
              <div className="setup-actions"><motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={finish}>Start my day</motion.button></div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
