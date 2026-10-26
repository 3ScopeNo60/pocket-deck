import type { Meal } from "../data/meals";
import { Sheet } from "./Sheets";

/** A meal's ingredients, how to make it, how to make it tastier and its numbers: what's on the back of its card. */
export function MealDetailSheet({ meal, onClose, onNutrients }: { meal: Meal | null; onClose: () => void; onNutrients: (mealId: string) => void }) {
  return (
    <Sheet open={!!meal} onOpenChange={(o) => !o && onClose()} title={meal ? meal.name : ""}>
      {meal && (
        <>
          {meal.tags.length > 0 && <div className="tags">{meal.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}

          <h3 className="section-label">What's in it</h3>
          <ul className="items">
            {meal.items.map(([e, w, q]) => {
              const opt = meal.optional?.find((o) => o.name === w);
              return (
                <li key={w} className="item">
                  <span className="emoji">{e}</span>
                  <span className="what">{w}{opt && <small className="opt-tag"> optional</small>}</span>
                  {q && <span className="pill">{q}</span>}
                </li>
              );
            })}
          </ul>

          <h3 className="section-label">How to make it</h3>
          <ol className="steps-read">
            {meal.steps.map((t) => (<li key={t}>{t}</li>))}
          </ol>

          {meal.boosters.length > 0 && (
            <>
              <h3 className="section-label">Make it tastier</h3>
              <ul className="boosters">
                {meal.boosters.map((b) => <li key={b} className="booster"><span className="emoji">✨</span>{b}</li>)}
              </ul>
            </>
          )}

          <h3 className="section-label">The numbers</h3>
          <dl className="nums">
            <div><dt>Sat fat</dt><dd>≈ {meal.sat.toFixed(1)} g</dd></div>
            <div><dt>Sol. fibre</dt><dd>≈ {meal.sol.toFixed(1)} g</dd></div>
            <div><dt>Sodium</dt><dd>≈ {Math.round(meal.na / 10) * 10} mg</dd></div>
            <div><dt>Energy</dt><dd>≈ {Math.round(meal.kcal / 5) * 5} kcal</dd></div>
            <div><dt>Cost</dt><dd>≈ R{meal.cost}</dd></div>
          </dl>
          <div className="sheet-actions">
            <button className="btn ghost" onClick={() => onNutrients(meal.id)}>All nutrients</button>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
