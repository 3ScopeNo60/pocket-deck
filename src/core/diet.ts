// His diet in plain words, to hand to anyone who asks (family, friends, a host, a waiter). The
// numbers are his own limits; everything else is general heart-healthy eating for high LDL.

export interface DietInput {
  /** Saturated fat limit, g a day. */
  satCap: number;
  /** Sodium limit, mg a day. */
  sodiumMax: number;
  /** Soluble fibre goal, g a day. */
  solMin: number;
  /** He takes a cholesterol tablet from his doctor. */
  onMedication: boolean;
}

export interface DietSection { heading: string; lines: string[] }
export interface Diet { title: string; intro: string; sections: DietSection[]; closing: string; text: string }

export function dietExplainer(i: DietInput): Diet {
  // 5 g of salt carries about 2,000 mg of sodium; a level teaspoon is roughly 5 g.
  const salt = Math.round((i.sodiumMax / 400) * 10) / 10;
  const sections: DietSection[] = [
    {
      heading: "What I'm doing",
      lines: [
        `Less saturated fat: about ${i.satCap} g a day at most. One tablespoon of butter already has about 7 g.`,
        `More soluble fibre: about ${i.solMin} g a day. It's in oats, barley, beans, lentils, chickpeas, apples and citrus, and it helps pull cholesterol down.`,
        `Less salt: under ${i.sodiumMax.toLocaleString("en-ZA")} mg of sodium a day, which is about ${salt} g of salt, or a level teaspoon.`,
      ],
    },
    {
      heading: "What I go easy on",
      lines: [
        "Butter, cream, full-fat cheese and fatty or processed meat (boerewors, polony, bacon).",
        "Pastry, pies and fried or battered food, and chicken with the skin on.",
        "Salty things: stock cubes, packet soups, brined meat, and most takeaways.",
      ],
    },
    {
      heading: "What I eat plenty of",
      lines: [
        "Oats, barley, beans, lentils and chickpeas.",
        "Fruit and vegetables, nuts and seeds, and olive oil instead of butter.",
        "Fish, skinless chicken, eggs in moderation, and plain low-fat yoghurt and milk.",
      ],
    },
    {
      heading: "If you're cooking for me",
      lines: [
        "Grilled, baked or roasted is perfect. A little olive oil instead of butter.",
        "Beans, lentils or chickpeas in a stew, soup or salad are a gift.",
        "Go light on cheese, cream and salt. Season with spices, herbs, lemon and garlic instead.",
        "Put sauces and dressings on the side, and I'll manage the rest.",
      ],
    },
    {
      heading: "If we're eating out",
      lines: [
        "I'll look for grilled or roasted over fried, and a vegetable or salad side.",
        "I'll skip the pastry and the creamy sauce, or share them.",
        "Please don't worry about me. One meal out doesn't undo anything.",
      ],
    },
  ];
  const intro = "I'm eating to bring my cholesterol down. In short: less saturated fat, more soluble fibre, less salt.";
  const closing = `Nothing is forbidden. It's the pattern over weeks that matters, not one meal. ${i.onMedication ? "I also take a daily tablet my doctor gave me, and the food works alongside it. " : ""}This is how I eat for my own situation, not advice for anyone else.`;
  return { title: "How I eat, in plain words", intro, sections, closing, text: [intro, ...sections.flatMap((s) => ["", s.heading, ...s.lines.map((l) => `• ${l}`)]), "", closing].join("\n") };
}
