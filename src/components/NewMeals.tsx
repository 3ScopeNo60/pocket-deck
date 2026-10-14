import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { shortfall } from "../core/planner";
import type { StockItem } from "../core/types";
import { foodMap, mealMap } from "../app/viewModel";
import { SwipeStack, type SwipeAction } from "./SwipeStack";

const ACTIONS: SwipeAction[] = [
  { dir: "left", label: "Not for me", emoji: "✕", stamp: "SKIP" },
  { dir: "right", label: "Add to rotation", emoji: "✓", stamp: "ADD" },
];

/**
 * "N new meals unlocked": a look at each one before it can ever be suggested. Every answer is saved
 * as it's given, so leaving halfway keeps what's been decided and the rest stay waiting.
 */
export function NewMeals({ ids, stock, onDecide, onClose }: { ids: string[]; stock: StockItem[]; onDecide: (id: string, keep: boolean) => void; onClose: () => void }) {
  // Freeze the list we started with: deciding removes a meal from `ids` as we go.
  const [deck] = useState(ids);
  const [i, setI] = useState(0);
  const [kept, setKept] = useState(0);
  const meal = deck[i] ? mealMap.get(deck[i]) : undefined;
  const missing = useMemo(() => (meal && !meal.bought ? shortfall(meal, stock, {}, foodMap) : []), [meal, stock]);

  return (
    <motion.div className="checkin" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
      <div className="checkin-col newmeals-col">
        <header className="newmeals-head">
          <div>
            <h1 className="setup-title">{meal ? `${deck.length} new ${deck.length === 1 ? "meal" : "meals"} unlocked` : "All caught up"}</h1>
            {meal && <p className="setup-count">{i + 1} of {deck.length}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </header>

        {meal ? (
          <SwipeStack
            key={meal.id}
            id={meal.id}
            actions={ACTIONS}
            onDecide={(d) => {
              onDecide(meal.id, d === "right");
              if (d === "right") setKept((k) => k + 1);
              setI(i + 1);
            }}
          >
            <div className="swipe-face meal">
              <div className="title"><div className="icon-tile"><span className="emoji">{meal.emoji}</span></div><h2 className="name">{meal.name}</h2></div>
              <div className="tags">{meal.tags.map((t) => <span key={t} className="tag">{t}</span>)}<span className="tag">{meal.cuisine}</span></div>
              <ul className="items">
                {meal.bought
                  ? <li className="item"><span className="emoji">{meal.emoji}</span><span className="what">{meal.bought.where}</span><span className="pill">R{meal.bought.price}</span></li>
                  : meal.items.map((it) => (
                      <li key={it.foodId} className="item"><span className="emoji">{foodMap.get(it.foodId)?.emoji}</span><span className="what">{foodMap.get(it.foodId)?.name}</span><span className="pill">{it.measure}</span></li>
                    ))}
              </ul>
              <p className={missing.length ? "k-sub" : "k-sub ready"}>
                {missing.length === 0 ? "You have everything for this now." : `You'd need ${missing.length} ${missing.length === 1 ? "thing" : "things"}: ${missing.map((m) => foodMap.get(m.foodId)?.name.toLowerCase()).slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}.`}
              </p>
            </div>
          </SwipeStack>
        ) : (
          <div className="setup-body center">
            <div className="setup-hero"><span className="emoji">{kept ? "✨" : "👌"}</span></div>
            <p className="setup-lede">{kept ? `${kept} ${kept === 1 ? "meal" : "meals"} added to your rotation. The rest are put away; you can bring them back from Kitchen › Unlock.` : "Nothing added this time. They're put away; you can bring them back from Kitchen › Unlock."}</p>
            <div className="setup-actions"><motion.button className="btn wide" whileTap={{ scale: 0.96 }} onClick={onClose}>Done</motion.button></div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
