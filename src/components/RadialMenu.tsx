// Radial menu — adapted from Bencho's "Radial menu" (MIT, bencho.dev/licence).
// Changes for Pocket Deck: it is the app's navigation, it lives in a bottom corner
// (so the fan is a quarter circle sweeping in from the screen edge), it can be
// mirrored for left-handed use. No labels: on a phone there is no hover to
// reveal them, and four icons this distinct don't need them. Bencho's comments are kept; numbers that changed
// with the geometry have their arithmetic redone in place.
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { motion } from "motion/react";

const hold = (e: React.PointerEvent) => e.stopPropagation();

/* Pointer capture is best effort and must never be the thing
   that decides whether the rest of a handler runs. It throws
   for a pointer id the element does not own, and anything
   sequenced after it is then silently skipped. Arm state
   first, capture last, and swallow the failure. */
const grab = (e: React.PointerEvent) => {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* the gesture still works through ordinary bubbling */
  }
};

/* ══ 2 · radial, one gesture ══════════════════════════════
   The interesting part is not the fan. It is that opening,
   choosing and committing are the same gesture: press, drag
   toward what you want, let go. No second tap, no travel back
   to a menu that opened somewhere else.

   A plain tap still works and leaves it open, because not
   everyone will discover the drag — but the drag is the point,
   and once you have it you never tap again. */

/* ══ How the options respond to a held thumb ════════════════
   Three feels, kept side by side until one is chosen. They share
   one idea taken from the "magnetic select" block: the thing you
   are over should not be a highlight, it should change the
   neighbourhood. Each answers it differently.

   lens   — the options swell continuously with how close your
            thumb's bearing is to them, like a dock. Nothing is
            shoved; the one you are heading for simply grows.
   magnet — the one you are aimed at takes the ink and the others
            give way: they shrink a little and are pushed along
            the line away from it, with the far ones a beat late.
   lean   — lens, softer, plus the whole fan tips toward your
            thumb as one body (the gaps never change).

   `strength` and `bounce` are 0–100 and mean the same in all
   three: how much it swells, and how much it overshoots when it
   arrives. Bounce is a damping RATIO so one setting rings the
   same on every chip whatever its stiffness. */
export type MenuMode = "off" | "lens" | "magnet" | "lean";
export interface MenuFeel { mode: MenuMode; strength: number; bounce: number }
export const DEFAULT_FEEL: MenuFeel = { mode: "lens", strength: 55, bounce: 45 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/* the shortest way round, so -170 and 170 are 20 apart */
const angGap = (a: number, b: number) => 180 - Math.abs((Math.abs(a - b) % 360) - 180);
const still = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface RadialItem {
  key: string;
  label: string;
  Icon: LucideIcon;
}

/* the count the geometry below was tuned at — see `reach`.
   Three, because the fan never offers the screen you are on:
   the core already shows it, and closing the fan returns you
   to it. */
const DEALT = 3;

/* A quarter circle, not Bencho's half. From a bottom corner a
   half circle would put the first and last options off the
   bottom of the screen; a quarter sweeps from along the bottom
   edge round to straight up, which is exactly the reach of a
   thumb resting on the core. */
const SPREAD = 90;

/* The radius is set from the gap the buttons should leave each
   other, not picked by eye. Neighbours sit SPREAD/(n-1) apart,
   so the space between two 48px circles is the chord
   2·R·sin(step/2) minus their diameter. With three on a
   quarter the step is 45 degrees, and at 68 — Bencho's own
   radius — that chord is 52: the same 4px gap his half circle
   leaves at five, and the fan still clears the 56px core by
   16. */
const RADIUS = 68;

export function RadialMenu({
  items,
  current,
  onSelect,
  hand = "right",
  radius = RADIUS,
  spread = SPREAD,
  /* how far apart the options leave the core. At 0 the fan
     opens as one shape; the higher it goes the more it reads
     as items being dealt out one after another. */
  stagger = 28,
  feel = DEFAULT_FEEL,
}: {
  items: RadialItem[];
  current: string;
  onSelect: (key: string) => void;
  /* which bottom corner the core sits in */
  hand?: "right" | "left";
  radius?: number;
  spread?: number;
  stagger?: number;
  feel?: MenuFeel;
}) {
  /* everything except where you already are */
  const arc = items.filter((o) => o.key !== current).slice(0, 6);

  /* ── the radius holds the GAP, not the number ────────────
     RADIUS is derived from how much room two buttons should
     leave each other — the note above it does the arithmetic —
     and it was derived at three. Put more on the same arc and
     the step closes, the chord between two 48px circles falls
     and they start to touch.

     So past three the fan opens outward by exactly what it
     takes to keep the chord it had. Below three it does not
     move at all: fewer options are further apart already, and
     pulling them in to keep the gap constant would crowd them
     onto the core.

     The knob still moves the radius at every count — this
     scales what it asks for rather than putting a floor under
     it, so there is no setting of the slider that does
     nothing. */
  const chordAt = (n: number) => Math.sin((spread / (n - 1) / 2) * (Math.PI / 180));
  const reach = radius * Math.max(1, chordAt(DEALT) / chordAt(arc.length));
  const [open, setOpen] = useState(false);
  const [aim, setAim] = useState<number | null>(null);
  /* where the thumb is, as an offset from where it went down */
  const [held, setHeld] = useState<{ dx: number; dy: number } | null>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /* whether the fan was already open when this press began —
     a press always opens it, so without remembering the state
     beforehand there is no way to tell an opening tap from a
     closing one, and it could never be dismissed */
  const wasOpen = useRef(false);

  /* Right hand: the first option lies along the bottom, pointing
     left (-180°), and the last points straight up (-90°).
     Left hand mirrors it: along the bottom pointing right (0°)
     round to straight up. Either way the first item is the
     easiest for the thumb to reach. */
  const angleOf = (i: number) => {
    const t = (spread / (arc.length - 1)) * i;
    return hand === "right" ? -180 + t : -t;
  };

  const nearest = (dx: number, dy: number) => {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    let best = 0;
    let gap = 999;
    arc.forEach((_, i) => {
      /* shortest way round the circle, so -170 and 170 read as
         20 apart rather than 340 */
      const d = 180 - Math.abs((Math.abs(a - angleOf(i)) % 360) - 180);
      if (d < gap) { gap = d; best = i; }
    });
    return best;
  };

  const choose = (i: number) => {
    setOpen(false);
    onSelect(arc[i].key);
  };

  const start = (e: React.PointerEvent) => {
    e.stopPropagation();
    down.current = { x: e.clientX, y: e.clientY, moved: false };
    wasOpen.current = open;
    setOpen(true);
    grab(e);
  };

  const move = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    /* a press that has not travelled is still a tap */
    if (Math.hypot(dx, dy) < 14) { setAim(null); setHeld(null); return; }
    d.moved = true;
    setHeld({ dx, dy });
    /* one note each time the aim crosses onto a different
       option — the fan is chosen by direction, and this is
       what tells you the direction landed somewhere */
    setAim(nearest(dx, dy));
  };

  const end = () => {
    const d = down.current;
    down.current = null;
    if (d?.moved && aim !== null) {
      choose(aim);
    } else if (wasOpen.current) {
      /* a tap on an open fan puts it away */
      setOpen(false);
    }
    setAim(null);
    setHeld(null);
  };

  /* ── what each option does about the thumb ────────────────
     Worked out from the fan's own geometry, never read back from
     the DOM: the chips are displaced by these numbers, and
     reading a position off something you are moving is a loop. */
  const mode = still() ? "off" : feel.mode;
  const p = clamp(feel.strength, 0, 100) / 100;
  const zeta = 0.9 - 0.48 * (clamp(feel.bounce, 0, 100) / 100);
  const swing = (k: number, mass = 1) => ({ type: "spring" as const, stiffness: k, damping: 2 * Math.sqrt(k * mass) * zeta, mass });
  const bearing = held ? (Math.atan2(held.dy, held.dx) * 180) / Math.PI : null;
  const dist = held ? Math.hypot(held.dx, held.dy) : 0;
  /* builds as the thumb travels outward, so a thumb resting near
     the core does not light up the whole fan */
  const ramp = clamp((dist - 14) / (reach * 0.6), 0, 1);
  const centres = arc.map((_, i) => {
    const a = (angleOf(i) * Math.PI) / 180;
    return { x: Math.cos(a) * reach, y: Math.sin(a) * reach, ux: Math.cos(a), uy: Math.sin(a) };
  });
  const chord = arc.length > 1 ? 2 * reach * Math.sin((spread / (arc.length - 1) / 2) * (Math.PI / 180)) : 52;

  const effect = (i: number) => {
    let x = 0, y = 0, scale = 1, rotate = 0, z = 1, wait = 0;
    if ((mode === "lens" || mode === "lean") && bearing !== null) {
      const w = Math.exp(-Math.pow(angGap(bearing, angleOf(i)) / 30, 2));
      const gain = mode === "lean" ? 0.12 + 0.26 * p : 0.14 + 0.30 * p;
      scale = 1 + gain * w * ramp;
      /* it also pops outward a few pixels, off the arc, so a swollen
         disc leaves its neighbours' side rather than sitting on it */
      x += centres[i].ux * 7 * p * w * ramp;
      y += centres[i].uy * 7 * p * w * ramp;
      z = 1 + Math.round(w * 4);
      if (mode === "lean") {
        /* ONE vector for the group, zero at the core, full out at the
           arc: the fan tips toward the thumb as a body and no gap
           changes. A per-chip lean would pull the fan apart. */
        const mag = clamp(dist / reach, 0, 1) * (2 + 5 * p);
        x += (held!.dx / (dist || 1)) * mag;
        y += (held!.dy / (dist || 1)) * mag;
      }
    }
    if (mode === "magnet" && aim !== null) {
      const grow = 1.16 + 0.22 * p;
      if (i === aim) { scale = grow; z = 5; }
      else {
        const room = (48 * (grow - 1)) / 2;
        const aura = 3 + 9 * p;
        const dx = centres[i].x - centres[aim].x;
        const dy = centres[i].y - centres[aim].y;
        const gap = Math.hypot(dx, dy) || 1;
        const far = gap / (chord || 52);
        const fall = Math.exp(-(far - 1) / 2.8);
        /* a constant push: two chips on one bearing move together and
           nothing ever closes up. `fall` drives the tilt and the
           cower, where a sense of reach belongs. */
        x += (dx / gap) * (room + aura);
        y += (dy / gap) * (room + aura);
        scale = 1 - (0.04 + 0.09 * p) * fall;
        rotate = (dx / gap) * 5 * p * fall;
        wait = far * 0.014;
      }
    }
    return { x, y, scale, rotate, z, wait };
  };

  const CurrentIcon = items.find((o) => o.key === current)?.Icon ?? items[0].Icon;

  return (
    <>
      {/* Not in Bencho's version. On a phone the fan opens over the
          meal card, so a tap anywhere else has to put it away
          rather than land on whatever is underneath. */}
      <div className="fan-scrim" data-open={open} onPointerDown={() => setOpen(false)} />
      {/* layout="position": when the hand setting flips, the whole menu glides to the other corner */}
      <motion.nav layout="position" transition={{ type: "spring", stiffness: 210, damping: 22 }} className="fan-well nav-fan" data-hand={hand} data-surface="glass" aria-label="Main">
        <div className="fan-arc" data-open={open}>
          {arc.map((o, i) => {
            const a = (angleOf(i) * Math.PI) / 180;
            const fx = effect(i);
            return (
              <button
                key={o.key}
                className="fan-opt"
                data-live={aim === i}
                style={{
                  transform: open
                    ? `translate(${Math.cos(a) * reach}px, ${Math.sin(a) * reach}px)`
                    : "translate(0, 0) scale(0.4)",
                  transitionDelay: `${open ? i * stagger : 0}ms`,
                  zIndex: fx.z,
                }}
                onClick={() => choose(i)}
                onPointerDown={hold}
                tabIndex={open ? 0 : -1}
                aria-label={o.label}
              >
                {/* 19 in a 48px circle. 16 was a third of it and
                    read as a label on a button rather than as the
                    tool itself. */}
                {/* The disc is its own element so its spring transform and
                    the fan's CSS transform on the button never share one
                    property — they would fight every frame. */}
                <motion.span
                  className="fan-disc gpane"
                  initial={false}
                  animate={{ x: fx.x, y: fx.y, scale: fx.scale, rotate: fx.rotate }}
                  transition={{
                    x: { ...swing(360, 0.9), delay: fx.wait },
                    y: { ...swing(360, 0.9), delay: fx.wait },
                    scale: { ...swing(460, 0.85), delay: fx.wait },
                    rotate: { ...swing(300, 1), delay: fx.wait },
                  }}
                >
                  <o.Icon size={19} strokeWidth={2} />
                </motion.span>
              </button>
            );
          })}
        </div>

        <button
          className="fan-core"
          data-open={open}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={open ? "Close menu" : "Menu"}
          aria-expanded={open}
        >
          {/* Closed, the core shows where you are; open, it shows
              how to leave. Bencho rotates a plus into a cross, which
              only works for a plus — a calendar turned 135° is just a
              calendar on its side — so the two glyphs swap instead. */}
          <span className="fan-glyph" data-show={!open}><CurrentIcon size={22} strokeWidth={2} /></span>
          <span className="fan-glyph" data-show={open}><X size={22} strokeWidth={2} /></span>
        </button>
      </motion.nav>
    </>
  );
}
