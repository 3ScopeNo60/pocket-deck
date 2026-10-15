import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { CalendarDays, ChartColumn, LayoutList, Refrigerator, UserRound } from "lucide-react";
import { SLOTS, TONIGHT, mealTimes, type SlotKey } from "./data/meals";
import { Deck, type ExitKind } from "./components/Deck";
import { TonightSheet } from "./components/Sheets";
import { CheckIn, type CheckInAnswer } from "./components/CheckIn";
import { DEFAULT_FEEL, RadialMenu, type RadialItem } from "./components/RadialMenu";
import { Kitchen } from "./components/Kitchen";
import { Me } from "./components/Me";
import { WeekScreen } from "./components/Week";
import { Setup } from "./components/Setup";
import { Progress } from "./components/Progress";
import { OffPlanSheet, type OffPlanTarget } from "./components/OffPlan";
import { BellButton, InboxSheet } from "./components/Inbox";
import { CardSwitcher, type SwitcherMode } from "./components/CardSwitcher";
import { NumbersSheet } from "./components/NumbersSheet";
import { buildInbox, type InboxItem } from "./core/inbox";
import { SupperNowSheet, TomorrowPanel } from "./components/Tomorrow";
import { tomorrowPlan } from "./core/tomorrow";
import { addDays } from "./app/history";
import { meals as allMeals } from "./core/content";
import { backupAgeWords, backupDue, lookbackDue } from "./core/nudges";
import { iso, lastDates, mealMap as histMeals, foodMap as histFoods, scoreDate } from "./app/history";
import { summarise } from "./core/score";
import { NewMeals } from "./components/NewMeals";
import { Sheet } from "./components/Sheets";
import { targets } from "./core/nutrition";
import { BUILD_ID, RELEASE_NOTES, newerBuild, whatsNewOnce, type ReleaseNotes } from "./app/updates";
import { useApp } from "./app/useApp";
import { mealMap, supperMap, toCard, foodMap } from "./app/viewModel";
import { isLow } from "./core/stock";
import { chosenMovements, movementTile } from "./app/movement";

const NAV: RadialItem[] = [
  { key: "today", label: "Today", Icon: LayoutList },
  { key: "week", label: "Week", Icon: CalendarDays },
  { key: "kitchen", label: "Kitchen", Icon: Refrigerator },
  { key: "progress", label: "Progress", Icon: ChartColumn },
  { key: "me", label: "Me", Icon: UserRound },
];

const dateLabel = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
const hour = new Date().getHours();
const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

/* One calm sentence about why today looks the way it does. */
function outlookLine(a: CheckInAnswer, carry: number): string | null {
  const name = a.lastNight ? supperMap.get(a.lastNight.supperId)?.name.toLowerCase() : null;
  if (carry >= 2 && a.tonight === "heavy") return `Last night's ${name} was a big one and tonight's heavy too, so today stays very lean.`;
  if (carry >= 2) return `Last night's ${name} was a big one, so today leans lean and high in fibre.`;
  if (carry > 0 && a.tonight === "heavy") return `Last night's ${name} was a bit rich and tonight's heavy, so today stays lean.`;
  if (carry > 0) return `Last night's ${name} was a bit rich, so today leans a little lighter.`;
  if (a.tonight === "heavy") return "Keeping today lean to make room for tonight's heavy supper.";
  // An ordinary day needs no explanation.
  return null;
}

export default function App() {
  const app = useApp();
  const [exit, setExit] = useState<ExitKind>({ kind: "eat" });
  const [flipped, setFlipped] = useState<SlotKey | null>(null);
  const [ticks, setTicks] = useState<Record<string, number[]>>({});
  const [checkIn, setCheckIn] = useState(false);
  const [tonightOpen, setTonightOpen] = useState(false);
  const [screen, setScreen] = useState<"today" | "kitchen" | "week" | "progress" | "me">("today");
  const { day, cards, emptySlots, actions } = app;
  const [reviewing, setReviewing] = useState(false);
  const [offPlan, setOffPlan] = useState<OffPlanTarget>(null);
  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [eatenOpen, setEatenOpen] = useState(false);
  /* the card he has chosen to see first, and a count for the shuffle animation */
  const [frontSlot, setFrontSlot] = useState<SlotKey | null>(null);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [supperOpen, setSupperOpen] = useState(false);
  // Read the release notes only once the main app is showing, so they aren't used up behind Setup.
  const [whats, setWhats] = useState<ReleaseNotes | null>(null);
  const mainShowing = app.ready && !app.needsSetup;
  useEffect(() => { if (mainShowing) setWhats(whatsNewOnce()); }, [mainShowing]);

  // Quiet Sunday look-back and monthly backup reminder.
  const todayIso = iso(new Date());
  const recordedDays = useMemo(() => app.allDays.filter((d) => d.eaten.length > 0 || (d.replaced ?? []).length > 0).length, [app.allDays]);
  const lookBack = useMemo(() => {
    if (!lookbackDue(todayIso, app.prefs.nudges, recordedDays)) return null;
    const byDate = new Map(app.allDays.map((d) => [d.date, d]));
    const cap = targets(app.profile).satCap;
    return summarise(lastDates(todayIso, 7).map((d) => scoreDate(d, byDate, cap, app.med)), histMeals, histFoods, "week");
  }, [todayIso, app.prefs.nudges, recordedDays, app.allDays, app.profile, app.med]);
  const backup = backupDue(todayIso, app.prefs.lastBackupAt, app.prefs.nudges, recordedDays);

  // Tomorrow: prep and shopping, worked out once daytime is done (or when asked for).
  const daytimeDone = !!day && cards.length === 0 && emptySlots.length === 0;
  const evening = !!day && new Date().getHours() >= 15;
  const tomorrowDate = addDays(todayIso, 1);
  const tomorrow = useMemo(() => {
    if (!daytimeDone && !tomorrowOpen && !evening) return null;
    return tomorrowPlan({
      date: tomorrowDate, week: app.week, meals: allMeals, foods: foodMap, products: app.products, prefs: app.prefs,
      satCap: targets(app.profile).satCap, stock: app.stock,
      recentMealIds: day ? (Object.values(day.plan).filter(Boolean) as string[]) : [],
    });
  }, [daytimeDone, tomorrowOpen, evening, tomorrowDate, app.week, app.products, app.prefs, app.profile, app.stock, day]);
  const listedIds = useMemo(() => new Set(app.shopping.map((r) => r.itemId)), [app.shopping]);
  const todayDot = useMemo(() => {
    if (!daytimeDone) return null;
    const byDate = new Map(app.allDays.map((d) => [d.date, d]));
    return scoreDate(todayIso, byDate, targets(app.profile).satCap, app.med).state;
  }, [daytimeDone, app.allDays, app.profile, app.med, todayIso]);
  const inbox = useMemo<InboxItem[]>(() => {
    if (!day) return [];
    const lowNames = app.stock
      .filter((s) => s.kind === "food" && foodMap.get(s.itemId) && isLow(foodMap.get(s.itemId)!, s.grams))
      .map((s) => foodMap.get(s.itemId)!.name);
    const unlisted = tomorrow ? tomorrow.needs.filter((n) => !listedIds.has(n.foodId)).map((n) => foodMap.get(n.foodId)?.name ?? n.foodId) : null;
    const med = app.med && app.med.pillsLeft >= 0 ? { id: app.med.id, pillsLeft: app.med.pillsLeft, perDay: (app.med.times?.length ?? 1) * (app.med.perDose ?? 1) } : null;
    const lastLab = app.labs.length ? app.labs[app.labs.length - 1].date : null;
    return buildInbox({
      todayIso, updateId, updateNote: RELEASE_NOTES.notes[0], newMealCount: app.newMealIds.length,
      tomorrowNeeds: unlisted, tomorrowDate, lowNames, med, lastLabDate: lastLab,
      lookback: lookBack ? { headline: lookBack.headline, tip: lookBack.suggestions[0] } : null,
      backup: { due: backup.due, words: backupAgeWords(backup.ageDays) },
    });
  }, [day, app.stock, app.med, app.labs, app.newMealIds, tomorrow, listedIds, todayIso, updateId, tomorrowDate, lookBack, backup.due, backup.ageDays]);
  const unread = inbox.filter((x) => !(app.prefs.inboxRead ?? []).includes(x.id));
  const act = (item: InboxItem, key: "open" | "dismiss") => {
    if (key === "dismiss") {
      if (item.kind === "lookback") actions.dismissNudge("lookback");
      if (item.kind === "backup") actions.dismissNudge("backup");
      return;
    }
    setInboxOpen(false);
    actions.markInboxRead(inbox.map((x) => x.id));
    switch (item.kind) {
      case "update": window.location.reload(); break;
      case "newmeals": setReviewing(true); break;
      case "shopping": if (tomorrow) { const n = actions.addToList(tomorrow.needs, "plan"); toast(n ? `Added ${n} ${n === 1 ? "thing" : "things"} to your list` : "Already on your list"); } break;
      case "low": setScreen("kitchen"); break;
      case "refill": setScreen("me"); break;
      case "labs": case "lookback": setScreen("progress"); break;
      case "backup": setScreen("me"); break;
    }
  };

  const panelProps = tomorrow && {
    plan: tomorrow,
    listed: listedIds,
    prepDone: app.prefs.prepDone?.date === tomorrowDate ? app.prefs.prepDone.ids : [],
    onTogglePrep: (id: string) => actions.togglePrep(tomorrowDate, id),
    onAddNeeds: () => {
      const n = actions.addToList(tomorrow.needs, "plan");
      toast(n ? `Added ${n} ${n === 1 ? "thing" : "things"} to your list` : "Already on your list");
    },
    supper: app.prefs.supperTonight?.date === todayIso ? { supperId: app.prefs.supperTonight.supperId, plate: app.prefs.supperTonight.plate } : null,
    onSupper: () => setSupperOpen(true),
    dot: todayDot,
  };

  // Tell the user when a newer build has been published, and offer to load it.
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const newer = await newerBuild();
      if (newer) {
        setUpdateId(newer.id);
        toast("A new version is ready", { id: "update", duration: Infinity, action: { label: "Update now", onClick: () => window.location.reload() } });
      }
    };
    void check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  // Every screen opens at the top, however far the last one was scrolled.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);

  const lowCount = app.stock.filter((s) => s.kind === "food" && foodMap.get(s.itemId) && isLow(foodMap.get(s.itemId)!, s.grams)).length;
  const move = movementTile(chosenMovements(app.profile));
  const doseCount = app.med?.times?.length ?? 1;
  const taken = day?.dosesTaken ?? (day?.tabletAt ? [day.tabletAt] : []);

  const cardFor = useMemo(() => {
    const map = new Map<SlotKey, ReturnType<typeof toCard>>();
    for (const c of cards) {
      const meal = mealMap.get(c.mealId);
      if (meal) map.set(c.slot, toCard(meal, c.nearMiss ? app.stock : undefined));
    }
    return map;
  }, [cards, app.stock]);

  if (!app.ready) return null;
  if (app.needsSetup) {
    return (
      <div className="col">
        <Setup
          profile={app.profile}
          prefs={app.prefs}
          onSaveProfile={actions.saveProfile}
          onAddToList={(id) => actions.addToList([{ foodId: id, needG: Math.min(...(foodMap.get(id)?.packSizes ?? [100])) }], "manual")}
          onFinish={actions.completeSetup}
          onSkip={actions.skipSetup}
        />
        <Toaster position="top-center" offset={64} toastOptions={{ className: "toast" }} />
      </div>
    );
  }

  const naturalSlots = cards.map((c) => c.slot);
  const orderedSlots = frontSlot && naturalSlots.includes(frontSlot) ? [frontSlot, ...naturalSlots.filter((s) => s !== frontSlot)] : naturalSlots;
  const topMeal = orderedSlots[0] ? cardFor.get(orderedSlots[0]) : undefined;
  const switcherMode = (app.prefs.switcher ?? "dots") as SwitcherMode;
  const switchTo = (slot: string) => {
    if (slot === orderedSlots[0]) return;
    setFlipped(null);
    setFrontSlot(slot === naturalSlots[0] ? null : (slot as SlotKey));
    setShuffleTick((t) => t + 1);
  };
  const budgetShown = Math.round(app.budget * 10) / 10;

  async function submit(a: CheckInAnswer) {
    setCheckIn(false);
    const changed = await actions.submitAnswer(a);
    if (changed.length) {
      setExit({ kind: "swap", dir: 1 });
      toast("Swapped " + changed.map((s) => SLOTS.find((x) => x.key === s)!.label.toLowerCase()).join(" and ") + " to keep today balanced");
    }
  }

  function swap(slot: SlotKey, dir: 1 | -1) {
    const ok = actions.swap(slot, dir);
    if (!ok) toast("That's the only one that fits today's plan");
    else {
      setExit({ kind: "swap", dir });
      setFlipped(null);
    }
    return ok;
  }

  return (
    <div className="col">
      {screen === "kitchen" && (
        <Kitchen
          stock={app.stock}
          shopping={app.shopping}
          products={app.products}
          prefs={app.prefs}
          actions={actions}
          initial={app.shopping.length ? "list" : "unlock"}
        />
      )}

      {screen === "week" && (
        <WeekScreen
          week={app.week}
          summary={app.weekSummary}
          onPlan={actions.planTheWeek}
          onTag={actions.tagNight}
          onSwap={actions.swapWeek}
          onToList={actions.weekToList}
          onOpenList={() => setScreen("kitchen")}
          listCount={app.shopping.length}
        />
      )}

      {screen === "progress" && (
        <Progress
          days={app.allDays}
          med={app.med}
          labs={app.labs}
          satCap={targets(app.profile).satCap}
          onSaveLab={actions.saveLab}
          onDeleteLab={actions.deleteLab}
        />
      )}

      {screen === "me" && (
        <Me
          profile={app.profile}
          onNumbers={() => setNumbersOpen(true)}
          onHand={(h) => actions.saveProfile({ ...app.profile, hand: h })}
          onMealTimes={(t) => actions.saveProfile({ ...app.profile, mealTimes: t })}
          med={app.med}
          onSaveMed={actions.saveMed}
          switcher={switcherMode}
          onSwitcher={actions.setSwitcher}
          menuFeel={app.prefs.menuFeel ?? DEFAULT_FEEL}
          onMenuFeel={actions.setMenuFeel}
          about={import.meta.env.MODE === "single" ? undefined : {
            version: BUILD_ID,
            onWhatsNew: () => setWhats(RELEASE_NOTES),
            onCheck: async () => {
              const newer = await newerBuild();
              if (newer) setUpdateId(newer.id);
              if (newer) toast("A new version is ready", { id: "update", duration: Infinity, action: { label: "Update now", onClick: () => window.location.reload() } });
              else toast("You're on the latest version");
            },
          }}
          onRedoSetup={actions.redoSetup}
          onBackedUp={actions.markBackedUp}
          lastBackupAt={app.prefs.lastBackupAt}
          onSave={(p) => {
            actions.saveProfile(p);
            toast("Saved. Your daily limits are updated.");
          }}
          onScenario={
            actions.devScenario
              ? async (sc) => {
                  await actions.devScenario!(sc);
                  setScreen(sc === "empty-kitchen" || sc === "stocked" ? "kitchen" : sc === "history" ? "progress" : "today");
                  setFlipped(null);
                  toast("Scenario loaded");
                }
              : undefined
          }
        />
      )}

      {screen === "today" && (<>
      <header>
        <div className="date">{dateLabel}</div>
        <h1 className="hello">{hello}</h1>
      </header>

      {app.memoryOnly && <p className="storage-note">Storage is blocked in this view, so today won't be remembered once you close it.</p>}

      {app.answer && day && (
        <section className="outlook">
          <AnimatePresence mode="wait" initial={false}>
            {outlookLine(app.answer, app.carry) && (
              <motion.div
                key={outlookLine(app.answer, app.carry)!}
                className="fit"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <span className="pip" />
                {outlookLine(app.answer, app.carry)}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="outlook-pills">
            <motion.button className="supper-pill" whileTap={{ scale: 0.95 }} onClick={() => setCheckIn(true)}>
              Last night: <b>{app.answer.lastNight ? supperMap.get(app.answer.lastNight.supperId)?.name : "Not logged"}</b>
            </motion.button>
            <motion.button className="supper-pill" whileTap={{ scale: 0.95 }} onClick={() => setTonightOpen(true)}>
              Tonight: <b>{TONIGHT[app.answer.tonight].label}</b>
            </motion.button>
          </div>
        </section>
      )}



      {day && <Deck
        collapsed={daytimeDone && !!panelProps}
        slots={orderedSlots}
        times={mealTimes(app.profile)}
        onNumbers={() => setNumbersOpen(true)}
        shuffle={shuffleTick}
        mealFor={(slot) => cardFor.get(slot)!}
        exit={exit}
        flipped={flipped}
        onFlip={setFlipped}
        onSwap={swap}
        onEat={(slot) => {
          setExit({ kind: "eat" });
          setFlipped(null);
          void actions.eat(slot);
        }}
        daySat={Math.round(app.daySat * 10) / 10}
        allowance={budgetShown}
        ticks={topMeal ? ticks[topMeal.id] ?? [] : []}
        onTick={(i) => {
          if (!topMeal) return;
          setTicks((t) => {
            const cur = t[topMeal.id] ?? [];
            return { ...t, [topMeal.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
          });
        }}
        onNotFeelingIt={(slot) => {
          if (actions.notFeelingIt(slot)) {
            setExit({ kind: "swap", dir: 1 });
            setFlipped(null);
            toast("Got it. You'll see that one less often.");
          } else toast("That's the only one that fits today's plan");
        }}
        onSomethingElse={(slot) => {
          setFlipped(null);
          setOffPlan({ mode: "replace", slot, slotLabel: SLOTS.find((x) => x.key === slot)!.label });
        }}
        onAddToList={(slot) => {
          const c = cards.find((x) => x.slot === slot);
          if (!c) return;
          const n = actions.addMealToList(c.mealId, "plan");
          toast(n ? `Added ${n} ${n === 1 ? "thing" : "things"} to your list` : "Already on your list");
        }}
        empty={!emptySlots.length && panelProps ? null : (
          <motion.div className="end" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
            <span className="emoji">{emptySlots.length ? "🛒" : "🍽️"}</span>
            <h2>{emptySlots.length ? "Nothing fits yet" : "Daytime done"}</h2>
            <p>
              {emptySlots.length
                ? `Nothing in the kitchen suits ${emptySlots.map((s) => SLOTS.find((x) => x.key === s)!.label.toLowerCase()).join(" or ")} today. The Kitchen will show what to pick up.`
                : "Enjoy supper. Tomorrow morning, tell me what it was and the day will balance around it."}
            </p>
            {!emptySlots.length && (
              <div className="done-prompts">
                {(app.shopping.length > 0 || lowCount > 0) && (
                  <button className="btn" onClick={() => setScreen("kitchen")}>
                    {app.shopping.length > 0
                      ? `${app.shopping.length} on your list${lowCount ? ` · ${lowCount} running low` : ""}`
                      : `${lowCount} running low`}
                  </button>
                )}
                <button className="btn ghost" onClick={() => setScreen("week")}>{app.week ? "See the week" : "Plan the week"}</button>
              </div>
            )}
          </motion.div>)
        }
      />}

      {day && !daytimeDone && cards.length > 1 && (
        <CardSwitcher
          mode={switcherMode}
          active={orderedSlots[0]}
          onPick={switchTo}
          items={naturalSlots.map((slot) => {
            const c = cardFor.get(slot);
            return { slot, label: SLOTS.find((x) => x.key === slot)!.label, emoji: c?.icon ?? "🍽️", name: c?.name ?? "", sat: c?.sat, nearMiss: cards.find((x) => x.slot === slot)?.nearMiss };
          })}
        />
      )}

      {day && daytimeDone && panelProps && <TomorrowPanel title="Daytime done" {...panelProps} />}

      <AnimatePresence initial={false}>
        {day && (day.eaten.length > 0 || (day.replaced ?? []).length > 0) && (
          <motion.section key="eaten" className="done" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {daytimeDone ? (
              <button className="eaten-toggle" aria-expanded={eatenOpen} onClick={() => setEatenOpen((o) => !o)}>
                <span className="section-label">Eaten today · {day.eaten.length + (day.replaced ?? []).length}</span>
                <span className="link">{eatenOpen ? "Hide" : "Show"}</span>
              </button>
            ) : (
              <h3 className="section-label">Eaten</h3>
            )}
            {(!daytimeDone || eatenOpen) && <AnimatePresence initial={false}>
              {day.eaten.map((e) => {
                const s = SLOTS.find((x) => x.key === e.slot)!;
                const m = mealMap.get(e.mealId);
                return (
                  <motion.div
                    key={e.slot}
                    layout
                    className="done-row"
                    initial={{ opacity: 0, y: -24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <span className="check" />
                    <span className="emoji">{m?.emoji}</span>
                    <span className="what"><b>{s.label}</b> · {m?.name}</span>
                    <span className="t">{e.at}</span>
                    <button onClick={() => { setExit({ kind: "eat" }); void actions.undo(e.slot); }}>Undo</button>
                  </motion.div>
                );
              })}
              {(day.replaced ?? []).map((r) => {
                const s = SLOTS.find((x) => x.key === r.slot)!;
                return (
                  <motion.div
                    key={`r-${r.slot}`}
                    layout
                    className="done-row"
                    initial={{ opacity: 0, y: -24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <span className="check" />
                    <span className="emoji">{r.size === "skipped" ? "⏭️" : "🍽️"}</span>
                    <span className="what"><b>{s.label}</b> · {r.size === "skipped" ? "Skipped" : r.what}</span>
                    <span className="t">{r.at}</span>
                    <button onClick={() => { setExit({ kind: "eat" }); void actions.undoReplaced(r.slot); }}>Undo</button>
                  </motion.div>
                );
              })}
            </AnimatePresence>}
          </motion.section>
        )}
      </AnimatePresence>

      {day && (
        <section className="also">
          <div className="also-head">
            <h3 className="section-label">Also today</h3>
            <span className="also-links">
              <button className="link" onClick={() => setOffPlan({ mode: "extra" })}>+ Extra{(day.extras ?? []).length ? ` (${(day.extras ?? []).length})` : ""}</button>
              <button className="link" onClick={() => setTomorrowOpen(true)}>Tomorrow</button>
            </span>
          </div>
          <div className="habits">
            <motion.button className="habit" aria-pressed={doseCount > 0 && taken.length >= doseCount} whileTap={{ scale: 0.95 }} onClick={() => void actions.toggleTablet()}>
              <span className="emoji">💊</span>
              <span className="txt">
                <span className="h1">{app.med?.name || "Tablet"}</span>
                <span className="h2">
                  {taken.length >= doseCount
                    ? `Taken ${taken[taken.length - 1]}${app.med ? ` · ${app.med.pillsLeft} left` : ""}`
                    : doseCount > 1
                      ? `${taken.length} of ${doseCount} · next ${app.med?.times?.[taken.length] ?? ""}`
                      : `Due ${app.med?.times?.[0] ?? app.med?.time ?? "20:00"}`}
                </span>
              </span>
            </motion.button>
            <motion.button className="habit" aria-pressed={day.walk} whileTap={{ scale: 0.95 }} onClick={() => void actions.toggleWalk()}>
              <span className="emoji">{move.emoji}</span>
              <span className="txt"><span className="h1">{move.label}</span><span className="h2">{day.walk ? "Done today" : move.hint}</span></span>
            </motion.button>
            {(day.extras ?? []).map((x, i) => (
              <div key={`${x.at}-${i}`} className="extra-row">
                <span>{x.kind} · {x.size}</span>
                <button className="link" onClick={() => void actions.removeExtra(i)}>Remove</button>
              </div>
            ))}
            {hour < 12 && <div className="cue"><span className="emoji">☕</span>Last coffee by 12:00 · filter or instant, not plunger</div>}
          </div>
        </section>
      )}

      </>)}

      {day && !app.needsCheckIn && !checkIn && <BellButton count={unread.length} onOpen={() => setInboxOpen(true)} />}
      <InboxSheet
        open={inboxOpen}
        items={inbox}
        read={app.prefs.inboxRead ?? []}
        onClose={() => { setInboxOpen(false); actions.markInboxRead(inbox.map((x) => x.id)); }}
        onAct={act}
      />

      <RadialMenu
        items={NAV}
        current={screen}
        hand={app.profile.hand}
        feel={app.prefs.menuFeel ?? DEFAULT_FEEL}
        onSelect={(key) => {
          if (key === "today" || key === "kitchen" || key === "week" || key === "progress" || key === "me") setScreen(key);
          else toast(`${NAV.find((n) => n.key === key)!.label} comes next`);
        }}
      />

      <AnimatePresence>
        {(app.needsCheckIn || checkIn) && (
          <CheckIn
            key="checkin"
            greeting={hello}
            date={dateLabel}
            initial={checkIn && app.answer ? app.answer
              : app.prefs.supperTonight?.date === addDays(todayIso, -1)
                ? { lastNight: { supperId: app.prefs.supperTonight.supperId, plate: app.prefs.supperTonight.plate }, tonight: "normal" }
                : null}
            changing={checkIn}
            onDone={submit}
            onClose={() => setCheckIn(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reviewing && (
          <NewMeals key="newmeals" ids={app.newMealIds} stock={app.stock} onDecide={actions.decideNewMeal} onClose={() => setReviewing(false)} />
        )}
      </AnimatePresence>
      <Sheet open={tomorrowOpen && !!panelProps} onOpenChange={setTomorrowOpen} title="Tomorrow">
        {panelProps && <TomorrowPanel {...panelProps} title="Tomorrow" dot={null} />}
      </Sheet>
      <SupperNowSheet
        open={supperOpen}
        current={panelProps?.supper ?? null}
        onClose={() => setSupperOpen(false)}
        onSave={(sp) => { actions.setSupperTonight(sp); setSupperOpen(false); toast("Got it. Tomorrow's question is answered."); }}
        onClear={() => { actions.setSupperTonight(null); setSupperOpen(false); }}
      />

      <NumbersSheet open={numbersOpen} onClose={() => setNumbersOpen(false)} />
      <OffPlanSheet
        target={offPlan}
        onClose={() => setOffPlan(null)}
        onSave={(what, size) => {
          const t = offPlan;
          setOffPlan(null);
          if (!t) return;
          if (t.mode === "replace") {
            setExit({ kind: "eat" });
            void actions.replaceSlot(t.slot as never, what, size);
            toast(size === "skipped" ? `${t.slotLabel} skipped. The rest of the day carries on.` : "Noted. The rest of the day is rebalanced around it.");
          } else {
            void actions.addExtra(what, size);
            toast("Noted. The rest of the day is rebalanced.");
          }
        }}
      />

      <Sheet open={!!whats} onOpenChange={(o) => !o && setWhats(null)} title={whats?.title ?? ""}>
        {whats && (
          <>
            <p className="k-sub">Updated just now.</p>
            <ul className="reasons">{whats.notes.map((n) => (<li key={n}>{n}</li>))}</ul>
            <div className="sheet-actions"><button className="btn wide" onClick={() => setWhats(null)}>Got it</button></div>
          </>
        )}
      </Sheet>
      <TonightSheet
        open={tonightOpen}
        current={app.answer?.tonight ?? "normal"}
        onClose={() => setTonightOpen(false)}
        onPick={(t) => {
          setTonightOpen(false);
          if (app.answer) void submit({ ...app.answer, tonight: t });
        }}
      />
      <Toaster position="top-center" offset={64} toastOptions={{ className: "toast" }} />
    </div>
  );
}
