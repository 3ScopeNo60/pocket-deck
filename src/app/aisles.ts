// Which supermarket aisle a food is in, for grouping the shopping list.
export const AISLES = ["Fresh produce", "Dairy & eggs", "Meat & fish", "Bakery", "Tins & dry goods", "Nuts, seeds & oils", "Spices & flavour", "Frozen"] as const;
export type Aisle = (typeof AISLES)[number];

const MAP: Record<string, Aisle> = {
  blueberries: "Fresh produce", apple: "Fresh produce", pear: "Fresh produce", orange: "Fresh produce", banana: "Fresh produce",
  avocado: "Fresh produce", greens: "Fresh produce", spinach: "Fresh produce", tomato: "Fresh produce",
  cucumber: "Fresh produce", "red-pepper": "Fresh produce", carrot: "Fresh produce", onion: "Fresh produce", "red-onion": "Fresh produce",
  garlic: "Fresh produce", mushrooms: "Fresh produce",
  "milk-lowfat": "Dairy & eggs", "almond-milk": "Dairy & eggs", "yoghurt-lowfat": "Dairy & eggs", egg: "Dairy & eggs", feta: "Dairy & eggs", hummus: "Dairy & eggs",
  "chicken-thigh": "Meat & fish", "chicken-breast": "Meat & fish",
  "wholewheat-bread": "Bakery", "rye-bread": "Bakery", "wholewheat-wrap": "Bakery",
  "berries-frozen": "Frozen", "mixed-veg-frozen": "Frozen",
  almonds: "Nuts, seeds & oils", walnuts: "Nuts, seeds & oils", "pumpkin-seeds": "Nuts, seeds & oils", chia: "Nuts, seeds & oils",
  flax: "Nuts, seeds & oils", "peanut-butter": "Nuts, seeds & oils", tahini: "Nuts, seeds & oils", "olive-oil": "Nuts, seeds & oils", "canola-oil": "Nuts, seeds & oils",
  "smoked-paprika": "Spices & flavour", cumin: "Spices & flavour", "chilli-flakes": "Spices & flavour", "curry-powder": "Spices & flavour",
  turmeric: "Spices & flavour", cinnamon: "Spices & flavour", "peri-peri-rub": "Spices & flavour", "soy-sauce-low": "Spices & flavour", "lemon-juice": "Spices & flavour", salsa: "Spices & flavour",
};

/** Anything not listed (tins, grains, pulses, pasta, rice) is "Tins & dry goods". */
export const aisleOf = (foodId: string): Aisle => MAP[foodId] ?? CUSTOM[foodId] ?? "Tins & dry goods";

/** Aisles for foods he added himself, filled in as they're loaded or created. */
const CUSTOM: Record<string, Aisle> = {};
export function setCustomAisle(foodId: string, aisle: string | undefined): void {
  if (aisle && (AISLES as readonly string[]).includes(aisle)) CUSTOM[foodId] = aisle as Aisle;
}

/** Cheap staples that make everything tastier; offered as a checklist in the Kitchen. */
export const FLAVOUR_KIT = ["smoked-paprika", "cumin", "chilli-flakes", "peri-peri-rub", "lemon-juice", "garlic", "tahini", "red-onion"] as const;
