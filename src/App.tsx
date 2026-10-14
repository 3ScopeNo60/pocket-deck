import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { CalendarDays, LayoutList, Refrigerator, UserRound } from "lucide-react";
import { SLOTS, TONIGHT, type SlotKey } from "./data/meals";
import { Deck, type ExitKind } from "./components/Deck";
import { TonightSheet } from "./components/Sheets";
import { CheckIn, type CheckInAnswer } from "./components/CheckIn";
import { RadialMenu, type RadialItem } from "./components/RadialMenu";
import { Kitchen } from "./components/Kitchen";
import { Me } from "./components/Me";
import { WeekScreen } from "./components/Week";
import { Setup } from "./components/Setup";
import { useApp } from "./app/useApp";
import { mealMap, supperMap, toCard, foodMap } from "./app/viewModel";
import { isLow } from "./core/stock";
import { chosenMovements, movementTile } from "./app/movement";

const NAV: RadialItem[] = [
  { key: "today", label: "Today", Icon: LayoutList },
  { key: "week", label: "Week", Icon: CalendarDays },
  { key: "kitchen", label: "Kitchen", Icon: Refrigerator },
  { key: "me", label: "Me", Icon: UserRound },
];

const dateLabel = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
const hour = new Date().getHours();
const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

/* One calm sentence about why today looks the way it does. */
function outlookLine(a: CheckInAnswer, carry: number) {
  const name = a.lastNight ? supperMap.get(a.lastNight.supperId)?.name.toLowerCase() : null;
  if (carry >= 2 && a.tonight === "heavy") return `Last night's ${name} was a big one and tonight's heavy too, so today stays very lean.`;
  if (carry >= 2) return `Last night's ${name} was a big one, so today leans lean and high in fibre.`;
  if (carry > 0 && a.tonight === "heavy") return `Last night's ${name} was a bit rich and tonight's heavy, so today stays lean.`;
  if (carry > 0) return `Last night's ${name} was a bit rich, so today leans a little lighter.`;
  if (a.tonight === "heavy") return "Keeping today lean to make room for tonight's heavy supper.";
  if (a.lastNight && a.tonight === "light") return "Easy night last night and a light one tonight. Plenty of room today.";
  if (a.lastNight) return "Last night was easy on the plan. Today has room for a normal supper.";
  return "Today's plan leaves room for a normal supper tonight.";
}

export default function App() {
  const app = useApp();
  const [exit, setExit] = useState<ExitKind>({ kind: "eat" });
  const [flipped, setFlipped] = useState<SlotKey | null>(null);
  const [ticks, setTicks] = useState<Record<string, number[]>>({});
  const [checkIn, setCheckIn] = useState(false);
  const [tonightOpen, setTonightOpen] = useState(false);
  const [screen, setScreen] = useState<"today" | "kitchen" | "week" | "me">("today");
  const { day, cards, emptySlots, actions } = app;

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
        <Toaster position="top-center" toastOptions={{ className: "toast" }} />
      </div>
    );
  }

  const top = cards[0];
  const topMeal = top ? cardFor.get(top.slot) : undefined;
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

      {screen === "me" && (
        <Me
          profile={app.profile}
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
                  setScreen(sc === "empty-kitchen" || sc === "stocked" ? "kitchen" : "today");
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
            <motion.div
              key={outlookLine(app.answer, app.carry)}
              className="fit"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <span className="pip" />
              {outlookLine(app.answer, app.carry)}
            </motion.div>
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
        slots={cards.map((c) => c.slot)}
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
        onAddToList={(slot) => {
          const c = cards.find((x) => x.slot === slot);
          if (!c) return;
          const n = actions.addMealToList(c.mealId, "plan");
          toast(n ? `Added ${n} ${n === 1 ? "thing" : "things"} to your list` : "Already on your list");
        }}
        empty={
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
          </motion.div>
        }
      />}

      <AnimatePresence initial={false}>
        {day && day.eaten.length > 0 && (
          <motion.section key="eaten" className="done" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h3 className="section-label">Eaten</h3>
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      {day && (
        <section className="also">
          <h3 className="section-label">Also today</h3>
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
                      : `${app.med?.times?.[0] ?? app.med?.time ?? "20:00"} · tap when taken`}
                </span>
              </span>
            </motion.button>
            <motion.button className="habit" aria-pressed={day.walk} whileTap={{ scale: 0.95 }} onClick={() => void actions.toggleWalk()}>
              <span className="emoji">{move.emoji}</span>
              <span className="txt"><span className="h1">{move.label}</span><span className="h2">{day.walk ? "Done today" : move.hint}</span></span>
            </motion.button>
            <div className="cue"><span className="emoji">☕</span>Last coffee by 12:00 · filter or instant, not plunger</div>
          </div>
        </section>
      )}

      </>)}

      <RadialMenu
        items={NAV}
        current={screen}
        hand={app.profile.hand}
        onSelect={(key) => {
          if (key === "today" || key === "kitchen" || key === "week" || key === "me") setScreen(key);
          else toast(`${NAV.find((n) => n.key === key)!.label} comes next`);
        }}
      />

      <AnimatePresence>
        {(app.needsCheckIn || checkIn) && (
          <CheckIn
            key="checkin"
            greeting={hello}
            date={dateLabel}
            initial={checkIn && app.answer ? app.answer : null}
            changing={checkIn}
            onDone={submit}
            onClose={() => setCheckIn(false)}
          />
        )}
      </AnimatePresence>
      <TonightSheet
        open={tonightOpen}
        current={app.answer?.tonight ?? "normal"}
        onClose={() => setTonightOpen(false)}
        onPick={(t) => {
          setTonightOpen(false);
          if (app.answer) void submit({ ...app.answer, tonight: t });
        }}
      />
      <Toaster position="top-center" toastOptions={{ className: "toast" }} />
    </div>
  );
}
