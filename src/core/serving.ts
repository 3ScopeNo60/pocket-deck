// A household measure weighed from a pack's label ("1 tsp" = 5 g) becomes one of the food's measures,
// so meals and his own recipes count that measure the way his pack does.
import type { Food } from "./types";

export function applyServing(food: Food | undefined, serving: { label: string; g: number } | undefined): void {
  if (!food || !serving || !(serving.g > 0) || !serving.label.trim()) return;
  food.measures[serving.label.trim()] = serving.g;
}
