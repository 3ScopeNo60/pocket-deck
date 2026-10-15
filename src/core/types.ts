export interface Profile {
  heightCm: number;
  weightKg: number;
  age: number;
  sex: "male" | "female";
  activity: "sedentary" | "light" | "moderate" | "very";
  hand: "right" | "left";
  budgetPerWeek: number;
  units: "kitchen" | "kitchen+grams";
  /** True once the user has entered his own measurements (until then the numbers are placeholders). */
  setUp?: boolean;
  /** When he eats, if not the usual 07:30, 13:00 and 16:30 (HH:MM). */
  mealTimes?: { breakfast?: string; lunch?: string; snack?: string };
  /** The daily movement he chose (see src/app/movement.ts). Defaults to a walk. */
  movement?: string;
  /** All the movements he does; any of them counts for the day. */
  movements?: string[];
}

export interface Per100 {
  kcal: number;
  sat: number;
  mono: number;
  poly: number;
  na: number;
  fibre: number;
  sol: number;
  betaGlucan: number;
}

export type Anchor = "betaGlucan" | "legume" | "nuts" | "goodFat";

export interface Food {
  id: string;
  name: string;
  emoji: string;
  per100: Per100;
  measures: Record<string, number>;
  keepsDays: number | null;
  anchors: Anchor[];
  cuisines: string[];
  packSizes: number[];
  /** For foods bought dry that are stocked cooked (rice, barley, lentils): cooked grams per dry gram. */
  cookedYield?: number | null;
  source: string;
}

export interface Product {
  id: string;
  foodId: string;
  name: string;
  per100: Partial<Per100> & { sat: number; na: number; kcal: number };
  packG: number;
  lastPrice: number;
  estimated: string[];
  /** True when the numbers were read from a nutrition label rather than the food list. */
  fromLabel?: boolean;
}

export interface MealItem {
  foodId: string;
  measure: string;
}

export interface BoughtMeal {
  where: string;
  price: number;
  per: Per100;
  /** What to ask for when ordering, e.g. "Ask for no feta". */
  orderNotes?: string[];
}

export interface Meal {
  id: string;
  slot: "breakfast" | "lunch" | "snack";
  name: string;
  emoji: string;
  items: MealItem[];
  steps: string[];
  boosters: string[];
  tags: string[];
  cuisine: string;
  bought?: BoughtMeal;
  prepGroup?: string;
  keepsDays: number;
}

export interface MealVersion {
  id: string;
  baseMealId: string;
  items: MealItem[];
}

export interface MealPref {
  /** "new" = shipped in an update and waiting for his decision; it is never dealt until he keeps it. */
  state: "kept" | "hidden" | "new";
  notFeelingUntil?: string;
}

export interface Prefs {
  /** Ids of every shipped meal he has been shown, so an update's additions can be told apart. */
  seenMeals?: string[];
  /** When the last backup file was made (ISO). */
  lastBackupAt?: string;
  /** Tonight's supper, told in the evening so tomorrow's check-in is already answered. */
  supperTonight?: { date: string; supperId: string; plate: "Small" | "Normal" | "Big" };
  /** Night-before prep ticked off for one date. */
  prepDone?: { date: string; ids: string[] };
  /** The control under the cards that brings another meal to the top. */
  switcher?: "off" | "dots";
  /** How the menu's options respond to a held thumb (see RadialMenu). */
  menuFeel?: { mode: "off" | "lens" | "magnet" | "lean"; strength: number; bounce: number };
  /** Ids of bell items he has seen. */
  inboxRead?: string[];
  /** Quiet prompts he has put away for now. */
  nudges?: { lookbackOn?: string; backupUntil?: string };
  /** True once Setup was finished or skipped, so it isn't offered again. */
  setupDone?: boolean;
  flavours: string[];
  foods: Record<string, "like" | "try" | "no">;
  meals: Record<string, MealPref>;
  firstTriedAt: Record<string, string>;
}

export interface LastNight {
  supperId: string;
  plate: "Small" | "Normal" | "Big";
}

export interface EatenEntry {
  slot: "breakfast" | "lunch" | "snack";
  mealId: string;
  at: string;
}

export interface ExtraEntry {
  kind: string;
  size: string;
  at: string;
}

export interface ReplacedEntry {
  slot: "breakfast" | "lunch" | "snack";
  what: string;
  size: string;
  at: string;
}

export interface Day {
  /** YYYY-MM-DD; the store key */
  date: string;
  lastNight: LastNight | null;
  tonight: "light" | "normal" | "heavy";
  plan: {
    breakfast: string | null;
    lunch: string | null;
    snack: string | null;
  };
  eaten: EatenEntry[];
  extras: ExtraEntry[];
  replaced: ReplacedEntry[];
  tabletAt?: string;
  /** Times today's doses were taken (HH:MM), one per dose. */
  dosesTaken?: string[];
  walk: boolean;
}

export interface WeekDay {
  /** Set once the day was changed by hand; re-planning leaves it alone. */
  pinned?: boolean;
  tonight?: "light" | "normal" | "heavy";
  plan?: {
    breakfast: string | null;
    lunch: string | null;
    snack: string | null;
  };
}

export interface PrepListItem {
  day: string;
  text: string;
  done: boolean;
}

export interface Week {
  weekOf: string;
  days: Record<string, WeekDay>;
  prepList: PrepListItem[];
}

export interface StockItem {
  itemId: string;
  kind: "food" | "product";
  grams: number;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  itemId: string;
  kind: "food" | "product";
  packs: number;
  shopUnitG: number;
  reason: "plan" | "unlock" | "low" | "manual";
  checked: boolean;
  /** Grams still needed when it was added; lets a re-add merge instead of doubling. */
  needG?: number;
}

export interface Med {
  id: string;
  name: string;
  dose: string;
  time: string;
  packSize: number;
  pillsLeft: number;
  takenLog: string[];
  /** Times of day he takes it, e.g. ["08:00", "20:00"]. Defaults to `[time]`. */
  times?: string[];
  /** Tablets each time. Defaults to 1. */
  perDose?: number;
}

export interface Lab {
  /** YYYY-MM-DD the blood was taken; the store key. */
  date: string;
  /** LDL cholesterol in mmol/L. */
  ldl: number;
  /** The rest are optional: enter what's on the report. mmol/L, ApoB in g/L. */
  total?: number;
  hdl?: number;
  trig?: number;
  apoB?: number;
  note?: string;
}

export interface Note {
  id: string;
  at: string;
  text: string;
}

export interface CustomSupper {
  id: string;
  name: string;
  emoji: string;
  group: "Home" | "Takeaway";
  sat: number;
  na: number;
}

export interface BackupFile {
  app: "pocket-deck";
  version: 1;
  exportedAt: string;
  stores: {
    profile: Profile[];
    foods: Food[];
    products: Product[];
    meals: Meal[];
    mealVersions: MealVersion[];
    prefs: Prefs[];
    days: Day[];
    week: Week[];
    stock: StockItem[];
    shopping: ShoppingItem[];
    meds: Med[];
    labs: Lab[];
    notes: Note[];
    customSuppers: CustomSupper[];
  };
}

export type StoreName =
  | "profile"
  | "foods"
  | "products"
  | "meals"
  | "mealVersions"
  | "prefs"
  | "days"
  | "week"
  | "stock"
  | "shopping"
  | "meds"
  | "labs"
  | "notes"
  | "customSuppers";

export type StoreKeyMap = {
  profile: "me";
  foods: string;
  products: string;
  meals: string;
  mealVersions: string;
  prefs: "me";
  days: string;
  week: string;
  stock: string;
  shopping: string;
  meds: string;
  labs: string;
  notes: string;
  customSuppers: string;
};

export type StoreValueMap = {
  profile: Profile;
  foods: Food;
  products: Product;
  meals: Meal;
  mealVersions: MealVersion;
  prefs: Prefs;
  days: Day;
  week: Week;
  stock: StockItem;
  shopping: ShoppingItem;
  meds: Med;
  labs: Lab;
  notes: Note;
  customSuppers: CustomSupper;
};
/** One ingredient the plan is short of: `haveG` is already net of what is reserved for other meals. */
export interface ShortfallItem {
  foodId: string;
  needG: number;
  haveG: number;
}
