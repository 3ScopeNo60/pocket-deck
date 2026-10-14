// The daily movement the user picks, in place of a fixed "walk". Roughly equivalent effort for a
// modest daily goal; nobody has to walk. Chosen in Me (and, later, during Setup).
export interface Movement {
  key: string;
  label: string;
  emoji: string;
  hint: string;
}

export const MOVEMENT: Movement[] = [
  { key: "walk", label: "Walk", emoji: "🚶", hint: "20–30 min, any pace you can talk at" },
  { key: "jog", label: "Jog", emoji: "🏃", hint: "15–20 min easy jogging" },
  { key: "cycle", label: "Cycle", emoji: "🚴", hint: "20–30 min, outdoors or indoors" },
  { key: "swim", label: "Swim", emoji: "🏊", hint: "15–20 min of lengths" },
  { key: "workout", label: "Home workout", emoji: "🏋️", hint: "15–20 min of squats, push-ups, steps" },
  { key: "yoga", label: "Yoga or stretching", emoji: "🧘", hint: "20–30 min, good for sleep too" },
  { key: "dance", label: "Dance", emoji: "💃", hint: "20–30 min to anything you like" },
];

export const movementFor = (key?: string): Movement => MOVEMENT.find((m) => m.key === key) ?? MOVEMENT[0];

/** Everything he does for movement. Reads the old single `movement` field too. */
export function chosenMovements(p: { movements?: string[]; movement?: string }): Movement[] {
  const keys = p.movements?.length ? p.movements : p.movement ? [p.movement] : ["walk"];
  return keys.map(movementFor);
}

/** What the Today tile calls the day's movement, however many he chose. */
export function movementTile(list: Movement[]): { label: string; emoji: string; hint: string } {
  const [a, b] = list;
  if (list.length === 1) return { label: a.label, emoji: a.emoji, hint: a.hint.split(",")[0] };
  if (list.length === 2) return { label: `${a.label} or ${b.label.toLowerCase()}`, emoji: a.emoji, hint: "Whichever you feel like" };
  return { label: "Movement", emoji: a.emoji, hint: `${a.label}, ${b.label.toLowerCase()}…` };
}
