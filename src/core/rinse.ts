// Foods that need draining and rinsing (tinned fish or beans in brine). The step is added to any
// meal that uses one, and the shopping list suggests something that doesn't need it next time.

/** The line shown on a meal that uses foods needing a rinse, or null when none does. */
export function rinseStep(foodNames: string[]): string | null {
  if (foodNames.length === 0) return null;
  const lower = foodNames.map((n) => n.toLowerCase());
  const list = lower.length === 1 ? lower[0] : `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
  return `Drain and rinse the ${list} first.`;
}

/** A meal's steps with the rinse step in front, once. */
export function withRinse(steps: string[], foodNames: string[]): string[] {
  const s = rinseStep(foodNames);
  return s && !steps.includes(s) ? [s, ...steps] : steps;
}

/** The suggestion on the shopping list for a food that needs rinsing. */
export const NO_RINSE_HINT = "Needs rinsing. Next time look for one in spring water or with no added salt.";
