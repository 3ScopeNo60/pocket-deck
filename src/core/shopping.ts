import type { Food, ShortfallItem, ShoppingItem } from "./types";

export type NewShoppingItem = Omit<ShoppingItem, "id" | "checked">;

export function packsFor(needG: number, packSizes: number[]): { packG: number; count: number } {
  if (needG <= 0) return { packG: packSizes[0] ?? 1, count: 0 };
  const sorted = [...packSizes].sort((a, b) => a - b);
  for (const pack of sorted) {
    if (pack >= needG) return { packG: pack, count: 1 };
  }
  const largest = sorted[sorted.length - 1];
  const count = Math.ceil(needG / largest);
  return { packG: largest, count };
}

export function listFromShortfalls(
  shortfalls: ShortfallItem[],
  foods: Map<string, Food>,
  reason: "plan" | "unlock" | "low" | "manual"
): NewShoppingItem[] {
  const merged = new Map<string, number>();
  for (const sf of shortfalls) {
    const food = foods.get(sf.foodId);
    if (!food) continue;
    const needG = sf.needG - sf.haveG;
    if (needG <= 0) continue;
    merged.set(sf.foodId, (merged.get(sf.foodId) ?? 0) + needG);
  }
  const result: NewShoppingItem[] = [];
  for (const [foodId, needG] of merged) {
    const food = foods.get(foodId);
    if (!food) continue;
    const { packG, count } = packsFor(needG, food.packSizes);
    result.push({
      itemId: foodId,
      kind: "food",
      packs: count,
      shopUnitG: packG,
      reason,
    });
  }
  return result;
}