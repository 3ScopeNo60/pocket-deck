import { describe, expect, it } from "vitest";
import { foods } from "./content";
import { matchLine, parseOrder } from "./order";

// What the reader made of a Sixty60 cart screenshot, product pictures and all.
const OCR = `Os, 60 MIN 16 items
Sub-total R597.24
Farmer's Choice Fresh Boneless
EEA & Skinless Chicken Thighs Per KG 61.37
700g
Qty: 1/1
Padkos Raw Almonds 100g
34.99
Qty: 1/1
| Checkers Housebrand
2ats. —- Wholegrain Rolled Oats 1kg sae
Pi wy:
TASTIC Tastic Wholegrain Long Grain
Le Brown Rice 2kg 44.99
ini Qty: 1/1
Checkers Housebrand Light
s st 5 Meat Shredded Tuna In Water 56.99
— 170g
Qty: 3/3
Saikav Chick Peas 410g
59.98
Qty: 2/2
& Sunlight Original Dishwashing
BR iiquia 750m eer`;

const find = (name: string, packG?: number) => matchLine({ name, packG, qty: 1 }, foods);

describe("parseOrder", () => {
  const lines = parseOrder(OCR);
  it("reads the items, sizes, quantities and totals", () => {
    expect(lines.map((l) => [l.qty, l.packG, l.total])).toEqual([
      [1, 700, 61.37],
      [1, 100, 34.99],
      [1, 2000, 44.99], // the oats' price was garbled; brown rice's 2kg line won it by layout
      [3, 170, 56.99],
      [2, 410, 59.98],
    ]);
  });
  it("leaves the header out and doesn't invent a line for the unfinished last item", () => {
    expect(lines.some((l) => /sub-total|items/i.test(l.name))).toBe(false);
    expect(lines.some((l) => /dishwash/i.test(l.name))).toBe(false);
  });
  it("takes a price that follows its Qty line", () => {
    const l = parseOrder("Padkos Raw Almonds 100g\nQty: 1/1\n34.99\nBanana 1kg\nQty: 2/2\n20.00");
    expect(l.map((x) => x.total)).toEqual([34.99, 20]);
  });
});

describe("matchLine", () => {
  it("matches shop names to foods", () => {
    expect(find("Padkos Raw Almonds 100g", 100)?.food.id).toBe("almonds");
    expect(find("Checkers Housebrand Wholegrain Rolled Oats 1kg", 1000)?.food.id).toBe("rolled-oats");
    expect(find("Tastic Wholegrain Long Grain Brown Rice 2kg", 2000)?.food.id).toBe("brown-rice");
    expect(find("Saikav Chick Peas 410g", 410)?.food.id).toBe("chickpeas");
    expect(find("Farmer's Choice Fresh Boneless & Skinless Chicken Thighs 700g", 700)?.food.id).toBe("chicken-thigh");
  });
  it("turns a tin's weight into the drained weight the app stocks", () => {
    const m = find("Checkers Housebrand Light Meat Shredded Tuna In Water 170g", 170)!;
    expect(m.food.id).toBe("tuna-water");
    expect(m.packG).toBe(120);
    expect(m.note).toMatch(/drained/);
    expect(find("Saikav Chick Peas 410g", 410)?.packG).toBe(240);
  });
  it("leaves non-food and unknown things unmatched", () => {
    expect(find("Sunlight Original Dishwashing Liquid 750ml", 750)).toBeNull();
    expect(find("Clover Full Cream Milk 2l", 2000)).toBeNull();
  });
  it("prefers the more specific food", () => {
    expect(find("Alpro Almond Milk Unsweetened 1l", 1000)?.food.id).toBe("almond-milk");
  });

  it("matches a trailing column of prices to the items without one, in order", () => {
    const l = parseOrder(`Padkos Raw Almonds 100g
Qty: 1/1
Checkers Housebrand Wholegrain Rolled Oats 1kg
Qty: 1/1
Saikav Chick Peas 410g
Qty: 2/2
Sunlight Original Dishwashing
Liquid 750ml
34.99
36.99
59.98
36.99`);
    expect(l.map((x) => x.total)).toEqual([34.99, 36.99, 59.98]);
  });
  it("leaves totals empty when the column doesn't line up", () => {
    const l = parseOrder("Padkos Raw Almonds 100g\nQty: 1/1\nBanana 1kg\nQty: 1/1\nSaikav Chick Peas 410g\nQty: 1/1\nSunlight Dishwashing\nLiquid 750ml\n34.99\n36.99");
    expect(l.map((x) => x.total)).toEqual([undefined, undefined, undefined]);
  });

  it("doesn't take a processed product for the food in its name", () => {
    for (const [name, food, word] of [
      ["Apple Juice 1l", "apple", "juice"], ["Egg Noodles 500g", "egg", "noodle"], ["Banana Bread 700g", "banana", "bread"],
      ["Carrot Cake 500g", "carrot", "cake"], ["All Gold Tomato Sauce 700ml", "tomato", "sauce"], ["Garlic Bread 400g", "garlic", "bread"],
    ] as const) {
      const m = find(name)!;
      expect(m.food.id, name).toBe(food);
      expect(m.unsure, name).toBe(word);
    }
    expect(find("Padkos Raw Almonds 100g")?.unsure).toBeUndefined();
    expect(find("Saikav Chick Peas 410g")?.unsure).toBeUndefined();
    expect(find("Tastic Wholegrain Long Grain Brown Rice 2kg", 2000)?.unsure).toBeUndefined(); // "rice" is in the food's own name
  });

  it("turns a tin's printed weight into the drained weight, for any food kept by drained weight", async () => {
    const { drainedPack } = await import("./order");
    const tuna = foods.find((f) => f.id === "tuna-water")!;
    expect(drainedPack(tuna, 170)).toMatchObject({ packG: 120 });
    expect(drainedPack(tuna, 100)).toBeNull(); // already small
    expect(drainedPack(foods.find((f) => f.id === "rolled-oats")!, 1000)).toBeNull(); // not a drained food
  });

  it("reads a multipack as the sum of its tins", () => {
    expect(parseOrder("Koo Baked Beans 6 x 410g\nQty: 1/1\n89.99")[0].packG).toBe(2460);
    expect(parseOrder("Yoghurt 4x175g\nQty: 2/2\n40.00")[0].packG).toBe(700);
    expect(parseOrder("Saikav Chick Peas 410g\nQty: 2/2\n59.98")[0].packG).toBe(410);
  });
});

