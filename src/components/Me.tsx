import { useRef, useState } from "react";
import { Clock, FlaskConical, HardDriveDownload, Info, Pill, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import type { MenuFeel } from "./RadialMenu";
import { AnimatePresence, motion } from "motion/react";
import { Segmented } from "./Segmented";
import { BackButton } from "./BackButton";
import { maintenanceKcal, targets } from "../core/nutrition";
import { toast } from "sonner";
import { MOVEMENT, chosenMovements } from "../app/movement";
import { ago, makeBackup, restoreBackup } from "../app/backupFile";
import type { Med, Profile } from "../core/types";
import { MedSheet } from "./MedEditor";
import { TimeWheel, mergeTime } from "./TimeWheel";
import { SLOTS, mealTimes, type SlotKey } from "../data/meals";
import { buildIcs } from "../core/ics";

const ACTIVITY: { key: Profile["activity"]; label: string; hint: string }[] = [
  { key: "sedentary", label: "Mostly seated", hint: "Desk job, little walking" },
  { key: "light", label: "Light", hint: "Some walking most days" },
  { key: "moderate", label: "Active", hint: "On your feet or exercising 3–5 days" },
  { key: "very", label: "Very active", hint: "Hard training most days" },
];

const num = (v: string) => Number(v.replace(",", "."));

/** Your measurements and a couple of settings. Saved to this phone only. */
export type Scenario = "fresh-day" | "braai" | "empty-kitchen" | "stocked" | "reset" | "history" | "new-meals";

const SCENARIOS: { key: Scenario; emoji: string; title: string; hint: string }[] = [
  { key: "fresh-day", emoji: "🌅", title: "Start the day again", hint: "Shows the morning check-in once more" },
  { key: "braai", emoji: "🍖", title: "Big braai last night, heavy tonight", hint: "Watch the day lean out and the cards change" },
  { key: "history", emoji: "📅", title: "A month of history", hint: "Fills Progress with days, summaries and sample blood results" },
  { key: "new-meals", emoji: "✨", title: "Three new meals unlocked", hint: "As if an update had just shipped them" },
  { key: "empty-kitchen", emoji: "🫙", title: "Empty kitchen", hint: "Near-miss cards and a long Unlock list" },
  { key: "stocked", emoji: "🛒", title: "Fully stocked kitchen", hint: "Every meal ready, empty Unlock list" },
  { key: "reset", emoji: "♻️", title: "Reset everything", hint: "Back to the starter pantry and placeholder profile" },
];

/* going deeper slides in from the right and going back from the left, so the screens have a place */
const PAGE = {
  in: (d: number) => ({ opacity: 0, x: 28 * d }),
  center: { opacity: 1, x: 0 },
  out: (d: number) => ({ opacity: 0, x: -28 * d }),
};

const FEEL_NAMES = { off: "Off", lens: "Lens", magnet: "Magnet", lean: "Lean" } as const;
const FEEL_HINTS = {
  off: "Only the option you're aimed at is ringed.",
  lens: "Buttons swell as your thumb gets closer, like a dock. Nothing else moves.",
  magnet: "The one you're aimed at takes the ink and the others give way.",
  lean: "A softer lens, and the whole fan tips toward your thumb.",
} as const;

type Page = null | "you" | "meds" | "times" | "feel" | "backup" | "app" | "try";

export function Me({ profile, onSave, onHand, onMealTimes, onScenario, onRedoSetup, onBackedUp, lastBackupAt, embedded, about, menuFeel, onMenuFeel, switcher, onSwitcher, med, onSaveMed }: { onHand?: (h: Profile["hand"]) => void; onMealTimes?: (t: Record<SlotKey, string>) => void; med?: Med | null; onSaveMed?: (m: Med | null) => void; switcher?: "off" | "dots" | "peek"; onSwitcher?: (m: "off" | "dots" | "peek") => void; menuFeel?: MenuFeel; onMenuFeel?: (f: MenuFeel) => void; about?: { version: string; onCheck: () => void; onWhatsNew: () => void }; profile: Profile; onSave: (p: Profile) => void; onScenario?: (s: Scenario) => void; onRedoSetup?: () => void; onBackedUp?: () => void; lastBackupAt?: string; embedded?: boolean }) {
  const [draft, setDraft] = useState({ h: String(profile.heightCm), w: String(profile.weightKg), a: String(profile.age) });
  const [sex, setSex] = useState(profile.sex);
  const [activity, setActivity] = useState(profile.activity);
  const [hand, setHand] = useState(profile.hand);
  const [medOpen, setMedOpen] = useState(false);
  const [page, setPage] = useState<Page>(null);
  const [timeSlot, setTimeSlot] = useState<SlotKey>("breakfast");
  /* Two wheels can report in the same tick, before the saved profile has come back round, so
     each change is applied to the latest times held here rather than to the prop. */
  const timesRef = useRef(mealTimes(profile));
  timesRef.current = mealTimes(profile);
  const changeTime = (part: { h?: number; m?: number }) => {
    const next = { ...timesRef.current, [timeSlot]: mergeTime(timesRef.current[timeSlot], part) };
    timesRef.current = next;
    onMealTimes?.(next);
  };
  const [dir, setDir] = useState<1 | -1>(1);
  const open = (p: Page) => { setDir(p === null ? -1 : 1); setPage(p); window.scrollTo({ top: 0 }); };
  const [movements, setMovements] = useState<string[]>(chosenMovements(profile).map((m) => m.key));
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);
  const toggleMovement = (k: string) => setMovements((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));

  const next: Profile = { ...profile, heightCm: num(draft.h), weightKg: num(draft.w), age: num(draft.a), sex, activity, hand, movement: movements[0], movements, setUp: true };
  const valid = next.heightCm >= 120 && next.heightCm <= 230 && next.weightKg >= 30 && next.weightKg <= 250 && next.age >= 18 && next.age <= 100;
  const t = valid ? targets(next) : null;
  const changed = JSON.stringify({ ...next }) !== JSON.stringify({ ...profile, setUp: true });

  const field = (key: "h" | "w" | "a", label: string, unit: string) => (
    <label className="me-field">
      <span className="me-label">{label}</span>
      <span className="me-input">
        <input inputMode="decimal" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value.replace(/[^0-9.,]/g, "") })} aria-label={label} />
        <span>{unit}</span>
      </span>
    </label>
  );


  const TILES: { key: Exclude<Page, null>; Icon: LucideIcon; title: string; status: string; show: boolean; hue: string }[] = [
    { key: "you", Icon: UserRound, title: "About you", status: profile.setUp ? `${profile.heightCm} cm · ${profile.weightKg} kg${t ? ` · ${t.satCap} g sat fat a day` : ""}` : "Add your numbers", show: true, hue: "sage" },
    { key: "meds", Icon: Pill, title: "Medication", status: med ? `${med.name}${med.dose ? ` ${med.dose}` : ""}` : "Not added yet", show: !!onSaveMed, hue: "blush" },
    { key: "times", Icon: Clock, title: "Meal times", status: Object.values(mealTimes(profile)).join(" · "), show: !!onMealTimes, hue: "peach" },
    { key: "feel", Icon: SlidersHorizontal, title: "Menu and cards", status: `${profile.hand === "right" ? "Right" : "Left"}-handed${menuFeel ? ` · ${FEEL_NAMES[menuFeel.mode]}` : ""}${switcher ? ` · ${switcher === "off" ? "No switcher" : switcher === "dots" ? "Dots" : "Peek"}` : ""}`, show: !!(menuFeel || switcher), hue: "sand" },
    { key: "backup", Icon: HardDriveDownload, title: "Back up", status: lastBackupAt ? `Last ${ago(lastBackupAt)}` : "Not backed up yet", show: !!onBackedUp, hue: "sky" },
    { key: "app", Icon: Info, title: "This app", status: about ? `Version ${about.version.slice(0, 12)}` : "Updates and setup", show: !!(about || onRedoSetup), hue: "lilac" },
    ...(import.meta.env.MODE === "single" && onScenario
      ? [{ key: "try" as const, Icon: FlaskConical, title: "Try a scenario", status: "Preview only", show: true, hue: "mint" }]
      : []),
  ];

  if (embedded) {
    return (
      <div className="kitchen">
      <section className="k-section">
          <h3 className="section-label">Your numbers</h3>
          <div className="me-grid">
            {field("h", "Height", "cm")}
            {field("w", "Weight", "kg")}
            {field("a", "Age", "years")}
          </div>
          <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
          <p className="k-sub">Used only to estimate how much energy you need. Nothing leaves this phone.</p>
        </section>

        <section className="k-section">
          <h3 className="section-label">How active are you?</h3>
          {ACTIVITY.map((a) => (
            <button key={a.key} className="krow" aria-pressed={activity === a.key} onClick={() => setActivity(a.key)}>
              <span className="kname">{a.label}<small>{a.hint}</small></span>
              <motion.span key={activity === a.key ? "on" : "off"} initial={{ scale: activity === a.key ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className={activity === a.key ? "pill" : "pill ghost"}>{activity === a.key ? "✓" : ""}</motion.span>
            </button>
          ))}
        </section>

        <section className="k-section">
          <h3 className="section-label">Daily movement</h3>
          <p className="k-sub">Choose as many as you like. Any one of them counts for the day, and they're roughly equal for your heart.</p>
          {MOVEMENT.map((m) => (
            <button key={m.key} className="krow" aria-pressed={movements.includes(m.key)} onClick={() => toggleMovement(m.key)}>
              <span className="emoji">{m.emoji}</span>
              <span className="kname">{m.label}<small>{m.hint}</small></span>
              <motion.span key={movements.includes(m.key) ? "on" : "off"} initial={{ scale: movements.includes(m.key) ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className={movements.includes(m.key) ? "pill" : "pill ghost"}>{movements.includes(m.key) ? "✓" : ""}</motion.span>
            </button>
          ))}
        </section>


      <section className="k-section">
          <h3 className="section-label">Menu hand</h3>
          <Segmented label="Menu hand" value={hand} onChange={(h) => { setHand(h); if (!embedded) onHand?.(h); }} options={[{ value: "right", label: "Right-handed" }, { value: "left", label: "Left-handed" }]} />
        </section>

      {t && (
          <section className="k-section">
            <h3 className="section-label">Your daily targets</h3>
            <div className="nums me-targets">
              <div><dt>Energy</dt><dd>{maintenanceKcal(next).toLocaleString("en-ZA")} kcal</dd></div>
              <div><dt>Sat fat limit</dt><dd>{t.satCap} g</dd></div>
              <div><dt>Sodium limit</dt><dd>{t.sodiumMax.toLocaleString("en-ZA")} mg</dd></div>
            </div>
            <p className="k-sub">Set to keep you energised, not to lose weight. Saturated fat is 6% of your energy.</p>
          </section>
        )}

      <motion.button className="btn wide" whileTap={{ scale: 0.96 }} disabled={!valid || (!changed && !!profile.setUp)} onClick={() => onSave(next)}>
          {profile.setUp ? "Save changes" : "Use these numbers"}
        </motion.button>
      </div>
    );
  }

  const here = page ? TILES.find((x) => x.key === page) : undefined;

  return (
    <div className="kitchen" data-hue={here?.hue}>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div key={page ?? "home"} className="me-page" custom={dir} variants={PAGE} initial="in" animate="center" exit="out" transition={{ duration: 0.2, ease: "easeOut" }}>
      <header>
        {page && here ? (
          <>
            <BackButton label="Me" where="Me" onClick={() => open(null)} />
            <div className="me-hero">
              <motion.span className="me-tile-icon" aria-hidden="true" initial={{ scale: 0.55, rotate: -24 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.05 }}><here.Icon size={22} strokeWidth={2} /></motion.span>
              <span className="me-tile-txt"><h1 className="hello">{here.title}</h1><small>{here.status}</small></span>
            </div>
          </>
        ) : (
          <h1 className="hello">Me</h1>
        )}
      </header>

      {!page && (
        <>
          {!profile.setUp && <p className="me-note">These are placeholder numbers. Add your own and the daily saturated-fat limit becomes yours.</p>}
          <div className="me-tiles">
            {TILES.filter((x) => x.show).map((x) => (
              <motion.button key={x.key} className="me-tile" data-hue={x.hue} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30, delay: 0.04 * TILES.filter((t) => t.show).findIndex((t) => t.key === x.key) }} whileTap={{ scale: 0.96 }} onClick={() => open(x.key)}>
                <span className="me-tile-icon" aria-hidden="true"><x.Icon size={21} strokeWidth={2} /></span>
                <span className="me-tile-txt"><b>{x.title}</b><small>{x.status}</small></span>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {page === "you" && (
        <>
      <section className="k-section">
            <h3 className="section-label">Your numbers</h3>
            <div className="me-grid">
              {field("h", "Height", "cm")}
              {field("w", "Weight", "kg")}
              {field("a", "Age", "years")}
            </div>
            <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
            <p className="k-sub">Used only to estimate how much energy you need. Nothing leaves this phone.</p>
          </section>

          <section className="k-section">
            <h3 className="section-label">How active are you?</h3>
            {ACTIVITY.map((a) => (
              <button key={a.key} className="krow" aria-pressed={activity === a.key} onClick={() => setActivity(a.key)}>
                <span className="kname">{a.label}<small>{a.hint}</small></span>
                <motion.span key={activity === a.key ? "on" : "off"} initial={{ scale: activity === a.key ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className={activity === a.key ? "pill" : "pill ghost"}>{activity === a.key ? "✓" : ""}</motion.span>
              </button>
            ))}
          </section>

          <section className="k-section">
            <h3 className="section-label">Daily movement</h3>
            <p className="k-sub">Choose as many as you like. Any one of them counts for the day, and they're roughly equal for your heart.</p>
            {MOVEMENT.map((m) => (
              <button key={m.key} className="krow" aria-pressed={movements.includes(m.key)} onClick={() => toggleMovement(m.key)}>
                <span className="emoji">{m.emoji}</span>
                <span className="kname">{m.label}<small>{m.hint}</small></span>
                <motion.span key={movements.includes(m.key) ? "on" : "off"} initial={{ scale: movements.includes(m.key) ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className={movements.includes(m.key) ? "pill" : "pill ghost"}>{movements.includes(m.key) ? "✓" : ""}</motion.span>
              </button>
            ))}
          </section>

      {t && (
            <section className="k-section">
              <h3 className="section-label">Your daily targets</h3>
              <div className="nums me-targets">
                <div><dt>Energy</dt><dd>{maintenanceKcal(next).toLocaleString("en-ZA")} kcal</dd></div>
                <div><dt>Sat fat limit</dt><dd>{t.satCap} g</dd></div>
                <div><dt>Sodium limit</dt><dd>{t.sodiumMax.toLocaleString("en-ZA")} mg</dd></div>
              </div>
              <p className="k-sub">Set to keep you energised, not to lose weight. Saturated fat is 6% of your energy.</p>
            </section>
          )}

      <motion.button className="btn wide" whileTap={{ scale: 0.96 }} disabled={!valid || (!changed && !!profile.setUp)} onClick={() => onSave(next)}>
            {profile.setUp ? "Save changes" : "Use these numbers"}
          </motion.button>
        </>
      )}
      {page === "meds" && (
        <>
      {onSaveMed && !embedded && (
            <section className="k-section">
              <h3 className="section-label">Medication</h3>
              {med ? (
                <button className="krow" onClick={() => setMedOpen(true)}>
                  <span className="emoji">💊</span>
                  <span className="kname">
                    {med.name}{med.dose ? ` ${med.dose}` : ""}
                    <small>{(med.perDose ?? 1) > 1 ? `${med.perDose} tablets · ` : ""}{(med.times?.length ?? 1) > 1 ? `${med.times!.length} times a day at ${med.times!.join(" and ")}` : `Every day at ${med.times?.[0] ?? med.time}`}{med.packSize || med.pillsLeft ? ` · ${med.pillsLeft} left` : ""}</small>
                  </span>
                  <span className="link">Change</span>
                </button>
              ) : (
                <>
                  <p className="k-sub">Add it once and the Tablet chip on Today counts doses and tablets left.</p>
                  <button className="btn small" onClick={() => setMedOpen(true)}>Add your medication</button>
                </>
              )}
              <MedSheet open={medOpen} med={med ?? null} onClose={() => setMedOpen(false)} onSave={(m) => { onSaveMed(m); setMedOpen(false); toast("Medication saved"); }} onRemove={() => { onSaveMed(null); setMedOpen(false); }} />
            </section>
          )}

        </>
      )}
      {page === "times" && onMealTimes && (
        <>
          <section className="k-section">
            <p className="k-sub">When you usually eat. The cards show these times, and the snack reminder uses the snack time.</p>
            <div className="chips" role="group" aria-label="Which meal">
              {SLOTS.map((sl) => (
                <button key={sl.key} className="chip" aria-pressed={timeSlot === sl.key} onClick={() => setTimeSlot(sl.key)}><span className="chip-two"><b>{sl.label}</b><small>{mealTimes(profile)[sl.key]}</small></span></button>
              ))}
            </div>
            <TimeWheel
              key={timeSlot}
              value={mealTimes(profile)[timeSlot]}
              onChange={changeTime}
            />
            <div className="blood-actions">
              <button className="btn small ghost" onClick={() => onMealTimes({ breakfast: "07:30", lunch: "13:00", snack: "16:30" })}>Back to the usual times</button>
              <button
                className="btn small"
                onClick={() => {
                  try {
                    const ics = buildIcs({ planTime: "18:00", snackTime: mealTimes(profile).snack, tabletTimes: med?.times, start: new Date() });
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
                }}
              >
                Update calendar reminders
              </button>
            </div>
            <p className="k-sub">If you've added Pocket Deck reminders to Calendar before, delete the old ones first so there aren't two.</p>
          </section>
        </>
      )}
      {page === "feel" && (
        <>
      <section className="k-section">
            <h3 className="section-label">Menu hand</h3>
            <Segmented label="Menu hand" value={hand} onChange={(h) => { setHand(h); if (!embedded) onHand?.(h); }} options={[{ value: "right", label: "Right-handed" }, { value: "left", label: "Left-handed" }]} />
          </section>

      {switcher && onSwitcher && !embedded && (
            <section className="k-section">
              <h3 className="section-label">See the other meals</h3>
              <p className="k-sub">A control under the cards that brings lunch or the snack to the top without eating breakfast first.</p>
              <Segmented label="Card switcher" value={switcher} onChange={onSwitcher} options={[{ value: "off", label: "Off" }, { value: "dots", label: "Dots" }, { value: "peek", label: "Peek" }]} />
              <p className="k-sub">{switcher === "off" ? "No control. Cards come in the order of the day." : switcher === "dots" ? "A dot for each meal. Touch one to bring it up, or hold and slide across them to riffle through." : "Tap to bring the next one up. Hold to open a list of everything coming, then slide up to one and let go."}</p>
            </section>
          )}

      {menuFeel && onMenuFeel && !embedded && (
            <section className="k-section">
              <h3 className="section-label">Menu feel</h3>
              <p className="k-sub">How the menu's buttons respond as you hold and slide your thumb across them. Try each one with the menu.</p>
              <Segmented label="Menu feel" value={menuFeel.mode} onChange={(m) => onMenuFeel({ ...menuFeel, mode: m })} options={[{ value: "off", label: "Off" }, { value: "lens", label: "Lens" }, { value: "magnet", label: "Magnet" }, { value: "lean", label: "Lean" }]} />
              <p className="k-sub">{FEEL_HINTS[menuFeel.mode]}</p>
              <label className="slider-row">
                <span>Strength</span>
                <input type="range" min={0} max={100} step={5} value={menuFeel.strength} aria-label="Strength" onChange={(e) => onMenuFeel({ ...menuFeel, strength: Number(e.target.value) })} />
                <motion.b key={menuFeel.strength} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>{menuFeel.strength}</motion.b>
              </label>
              <label className="slider-row">
                <span>Bounce</span>
                <input type="range" min={0} max={100} step={5} value={menuFeel.bounce} aria-label="Bounce" onChange={(e) => onMenuFeel({ ...menuFeel, bounce: Number(e.target.value) })} />
                <motion.b key={menuFeel.bounce} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>{menuFeel.bounce}</motion.b>
              </label>
            </section>
          )}

        </>
      )}
      {page === "backup" && (
        <>
      {onBackedUp && !embedded && (
            <section className="k-section">
              <h3 className="section-label">Back up and restore</h3>
              <p className="k-sub">Everything lives only on this phone. A backup is one file you can keep in Files or iCloud Drive. Last backup: <b>{ago(lastBackupAt)}</b>.</p>
              <button
                className="krow"
                onClick={async () => {
                  const r = await makeBackup();
                  if (r === "shared" || r === "downloaded") { onBackedUp(); toast(r === "shared" ? "Backed up" : "Backup file saved"); }
                  else if (r === "blocked") toast("This view can't save files. It works in the installed app.");
                }}
              >
                <span className="emoji">💾</span>
                <span className="kname">Back up now<small>Choose Save to Files or iCloud Drive</small></span>
              </button>
              <label className="krow">
                <span className="emoji">📂</span>
                <span className="kname">Restore from a backup<small>Replaces everything on this phone</small></span>
                <input type="file" accept=".json,application/json" hidden aria-label="Choose a backup file" onChange={(e) => { setPendingRestore(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </label>
              {pendingRestore && (
                <div className="setup-card restore">
                  <p className="setup-lede">Replace everything on this phone with <b>{pendingRestore.name}</b>? What's here now will be gone.</p>
                  <div className="sheet-actions">
                    <button className="btn ghost" onClick={() => setPendingRestore(null)}>Keep what's here</button>
                    <motion.button
                      className="btn"
                      whileTap={{ scale: 0.96 }}
                      onClick={async () => {
                        try {
                          await restoreBackup(pendingRestore);
                          window.location.reload();
                        } catch (err) {
                          toast((err as Error).message || "Couldn't restore that file.");
                          setPendingRestore(null);
                        }
                      }}
                    >
                      Replace everything
                    </motion.button>
                  </div>
                </div>
              )}
            </section>
          )}

        </>
      )}
      {page === "app" && (
        <>
      {about && !embedded && (
            <section className="k-section">
              <h3 className="section-label">About this app</h3>
              <p className="k-sub">Version <b>{about.version}</b></p>
              <div className="blood-actions">
                <button className="btn small ghost" onClick={about.onCheck}>Check for updates</button>
                <button className="btn small ghost" onClick={about.onWhatsNew}>What's new</button>
              </div>
            </section>
          )}

      {onRedoSetup && !embedded && (
            <section className="k-section">
              <h3 className="section-label">Setup</h3>
              <button className="krow" onClick={onRedoSetup}>
                <span className="emoji">🔁</span>
                <span className="kname">Go through setup again<small>Your flavours, foods, meals and medication</small></span>
              </button>
            </section>
          )}

        </>
      )}
      {page === "try" && (
        <>
      {import.meta.env.MODE === "single" && onScenario && !embedded && (
            <section className="k-section">
              <h3 className="section-label">Try a scenario <span className="optional">Preview only</span></h3>
              {SCENARIOS.map((sc) => (
                <button key={sc.key} className="krow" onClick={() => onScenario(sc.key)}>
                  <span className="emoji">{sc.emoji}</span>
                  <span className="kname">{sc.title}<small>{sc.hint}</small></span>
                </button>
              ))}
            </section>
          )}

        </>
      )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}
