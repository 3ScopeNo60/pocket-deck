import { useState } from "react";
import type { MenuFeel } from "./RadialMenu";
import { motion } from "motion/react";
import { maintenanceKcal, targets } from "../core/nutrition";
import { toast } from "sonner";
import { MOVEMENT, chosenMovements } from "../app/movement";
import { ago, makeBackup, restoreBackup } from "../app/backupFile";
import type { Profile } from "../core/types";

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

const FEEL_NAMES = { off: "Off", lens: "Lens", magnet: "Magnet", lean: "Lean" } as const;
const FEEL_HINTS = {
  off: "Only the option you're aimed at is ringed.",
  lens: "Buttons swell as your thumb gets closer, like a dock. Nothing else moves.",
  magnet: "The one you're aimed at takes the ink and the others give way.",
  lean: "A softer lens, and the whole fan tips toward your thumb.",
} as const;

export function Me({ profile, onSave, onScenario, onRedoSetup, onBackedUp, lastBackupAt, embedded, about, menuFeel, onMenuFeel, switcher, onSwitcher }: { switcher?: "off" | "dots" | "peek"; onSwitcher?: (m: "off" | "dots" | "peek") => void; menuFeel?: MenuFeel; onMenuFeel?: (f: MenuFeel) => void; about?: { version: string; onCheck: () => void; onWhatsNew: () => void }; profile: Profile; onSave: (p: Profile) => void; onScenario?: (s: Scenario) => void; onRedoSetup?: () => void; onBackedUp?: () => void; lastBackupAt?: string; embedded?: boolean }) {
  const [draft, setDraft] = useState({ h: String(profile.heightCm), w: String(profile.weightKg), a: String(profile.age) });
  const [sex, setSex] = useState(profile.sex);
  const [activity, setActivity] = useState(profile.activity);
  const [hand, setHand] = useState(profile.hand);
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

  return (
    <div className="kitchen">
      {!embedded && (
        <header>
          <h1 className="hello">Me</h1>
        </header>
      )}

      {!profile.setUp && !embedded && (
        <p className="me-note">These are placeholder numbers. Add your own and the daily saturated-fat limit becomes yours.</p>
      )}

      <section className="k-section">
        <h3 className="section-label">About you</h3>
        <div className="me-grid">
          {field("h", "Height", "cm")}
          {field("w", "Weight", "kg")}
          {field("a", "Age", "years")}
        </div>
        <div className="seg seg-2" role="group" aria-label="Sex">
          {(["male", "female"] as const).map((s) => (
            <button key={s} aria-pressed={sex === s} onClick={() => setSex(s)}>{s === "male" ? "Male" : "Female"}</button>
          ))}
        </div>
        <p className="k-sub">Used only to estimate how much energy you need. Nothing leaves this phone.</p>
      </section>

      <section className="k-section">
        <h3 className="section-label">How active are you?</h3>
        {ACTIVITY.map((a) => (
          <button key={a.key} className="krow" aria-pressed={activity === a.key} onClick={() => setActivity(a.key)}>
            <span className="kname">{a.label}<small>{a.hint}</small></span>
            <span className={activity === a.key ? "pill" : "pill ghost"}>{activity === a.key ? "✓" : ""}</span>
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
            <span className={movements.includes(m.key) ? "pill" : "pill ghost"}>{movements.includes(m.key) ? "✓" : ""}</span>
          </button>
        ))}
      </section>

      <section className="k-section">
        <h3 className="section-label">Menu hand</h3>
        <div className="seg seg-2" role="group" aria-label="Menu hand">
          {(["right", "left"] as const).map((h) => (
            <button key={h} aria-pressed={hand === h} onClick={() => setHand(h)}>{h === "right" ? "Right-handed" : "Left-handed"}</button>
          ))}
        </div>
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

      {switcher && onSwitcher && !embedded && (
        <section className="k-section">
          <h3 className="section-label">See the other meals</h3>
          <p className="k-sub">A control under the cards that brings lunch or the snack to the top without eating breakfast first.</p>
          <div className="seg seg-3" role="group" aria-label="Card switcher">
            {(["off", "dots", "peek"] as const).map((m) => (
              <button key={m} aria-pressed={switcher === m} onClick={() => onSwitcher(m)}>{m === "off" ? "Off" : m === "dots" ? "Dots" : "Peek"}</button>
            ))}
          </div>
          <p className="k-sub">{switcher === "off" ? "No control. Cards come in the order of the day." : switcher === "dots" ? "A dot for each meal. Touch one to bring it up, or hold and slide across them to riffle through." : "Tap to bring the next one up. Hold to open a list of everything coming, then slide up to one and let go."}</p>
        </section>
      )}

      {menuFeel && onMenuFeel && !embedded && (
        <section className="k-section">
          <h3 className="section-label">Menu feel</h3>
          <p className="k-sub">How the menu's buttons respond as you hold and slide your thumb across them. Try each one with the menu.</p>
          <div className="seg seg-4" role="group" aria-label="Menu feel">
            {(["off", "lens", "magnet", "lean"] as const).map((m) => (
              <button key={m} aria-pressed={menuFeel.mode === m} onClick={() => onMenuFeel({ ...menuFeel, mode: m })}>{FEEL_NAMES[m]}</button>
            ))}
          </div>
          <p className="k-sub">{FEEL_HINTS[menuFeel.mode]}</p>
          <label className="slider-row">
            <span>Strength</span>
            <input type="range" min={0} max={100} step={5} value={menuFeel.strength} aria-label="Strength" onChange={(e) => onMenuFeel({ ...menuFeel, strength: Number(e.target.value) })} />
            <b>{menuFeel.strength}</b>
          </label>
          <label className="slider-row">
            <span>Bounce</span>
            <input type="range" min={0} max={100} step={5} value={menuFeel.bounce} aria-label="Bounce" onChange={(e) => onMenuFeel({ ...menuFeel, bounce: Number(e.target.value) })} />
            <b>{menuFeel.bounce}</b>
          </label>
        </section>
      )}

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

      {onRedoSetup && !embedded && (
        <section className="k-section">
          <h3 className="section-label">Setup</h3>
          <button className="krow" onClick={onRedoSetup}>
            <span className="emoji">🔁</span>
            <span className="kname">Go through setup again<small>Your flavours, foods, meals and medication</small></span>
          </button>
        </section>
      )}

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

      <motion.button className="btn wide" whileTap={{ scale: 0.96 }} disabled={!valid || (!changed && !!profile.setUp)} onClick={() => onSave(next)}>
        {profile.setUp ? "Save changes" : "Use these numbers"}
      </motion.button>
    </div>
  );
}
