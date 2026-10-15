// UI-facing meal shape and constants. The real content lives in src/content and is planned by src/core.

export type SlotKey = "breakfast" | "lunch" | "snack";

export interface Meal {
  id: string;
  icon: string;
  name: string;
  /** [emoji, ingredient, kitchen measure] */
  items: [string, string, string][];
  tags: string[];
  steps: string[];
  boosters: string[];
  bought?: boolean;
  sat: number; // g saturated fat
  na: number; // mg sodium
  sol: number; // g soluble fibre
  kcal: number;
  cost: number; // rand
  /** Names of ingredients the kitchen is short of, for a near-miss card. */
  missing?: string[];
  /** Extra order notes for a bought meal, e.g. "Ask for no feta". */
  orderNotes?: string[];
}

export const SLOTS: { key: SlotKey; label: string; when: string }[] = [
  { key: "breakfast", label: "Breakfast", when: "07:30" },
  { key: "lunch", label: "Lunch", when: "13:00" },
  { key: "snack", label: "Fibre snack", when: "16:30" },
];

/** When each meal is eaten: his own time if he has set one, otherwise the usual. */
export function mealTimes(profile: { mealTimes?: Partial<Record<SlotKey, string>> }): Record<SlotKey, string> {
  const own = profile.mealTimes ?? {};
  return Object.fromEntries(SLOTS.map((s) => [s.key, /^\d{2}:\d{2}$/.test(own[s.key] ?? "") ? own[s.key]! : s.when])) as Record<SlotKey, string>;
}

/** What's expected tonight. Unknown counts as normal. */
export type Tonight = "light" | "normal" | "heavy";

/** Saturated fat (g) held back for tonight's supper. */
export const TONIGHT: Record<Tonight, { label: string; icon: string; buffer: number }> = {
  light: { label: "Light", icon: "🥗", buffer: 4 },
  normal: { label: "Normal", icon: "🍽️", buffer: 7 },
  heavy: { label: "Heavy", icon: "🍖", buffer: 11 },
};

export const PLATES = { Small: 0.7, Normal: 1, Big: 1.35 } as const;
export type Plate = keyof typeof PLATES;
