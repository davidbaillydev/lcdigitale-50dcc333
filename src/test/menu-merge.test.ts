import { describe, expect, it } from "vitest";
import { mergeMenu } from "@/lib/menu-merge";
import type { Category } from "@/lib/menu";

const existing: Category[] = [{ id: "cat-1", label: "Desserts", note: "Maison", items: [
  { id: "item-1", name: "Mochi", price: 4.5, hidden: true, desc: "Vanille", removable: [], allergens: ["lait"] },
] }];

describe("staged menu merge", () => {
  it("adds new dishes to the corresponding existing category", () => {
    const result = mergeMenu(existing, [{ id: "import-0", label: " desserts ", items: [{ id: "import-0-0", name: "Fondant", price: 6 }] }]);
    expect(result.menu).toHaveLength(1);
    expect(result.menu[0]?.items.map((item) => item.name)).toEqual(["Mochi", "Fondant"]);
    expect(result.summary).toEqual({ addedItems: 1, enrichedCategories: 1, createdCategories: 0, skippedDuplicates: 0 });
  });
  it("creates new categories once and counts distinct enriched categories", () => {
    const result = mergeMenu(existing, [
      { id: "a", label: "Boissons", items: [{ id: "a", name: "Coca", price: 2 }] },
      { id: "b", label: "BOISSONS", items: [{ id: "a", name: "Sprite", price: 2 }] },
      { id: "c", label: "Desserts", items: [{ id: "a", name: "Cookie", price: 3 }] },
      { id: "d", label: "Desserts", items: [{ id: "a", name: "Tarte", price: 5 }] },
    ]);
    expect(result.menu.map((category) => category.label)).toEqual(["Desserts", "Boissons"]);
    expect(result.summary).toEqual({ addedItems: 4, enrichedCategories: 1, createdCategories: 1, skippedDuplicates: 0 });
  });
  it("preserves all existing metadata and does not mutate either input", () => {
    const before = structuredClone(existing);
    const incoming: Category[] = [{ id: "a", label: "Desserts", items: [{ id: "b", name: "Tarte", price: 5 }] }];
    const snapshot = structuredClone(incoming);
    const result = mergeMenu(existing, incoming);
    expect(result.menu[0]).toEqual({ ...before[0], items: [...(before[0]?.items ?? []), expect.objectContaining({ name: "Tarte" })] });
    expect(existing).toEqual(before);
    expect(incoming).toEqual(snapshot);
  });
  it("skips exact duplicate names globally and within the import without overwriting prices", () => {
    const result = mergeMenu(existing, [{ id: "a", label: "Nouveautés", items: [
      { id: "b", name: " MOCHI ", price: 99 },
      { id: "c", name: "Mochi fraise", price: 5 },
      { id: "d", name: "mochi fraise", price: 7 },
    ] }]);
    expect(result.menu[0]?.items[0]?.price).toBe(4.5);
    expect(result.menu[1]?.items.map((item) => item.name)).toEqual(["Mochi fraise"]);
    expect(result.summary.addedItems).toBe(1);
    expect(result.summary.skippedDuplicates).toBe(2);
  });
  it("generates unique IDs despite existing collisions and repeated imports", () => {
    const first = mergeMenu([{ id: "import-cat-1", label: "Vide", items: [{ id: "import-item-3", name: "Ancien", price: 1 }] }],
      [{ id: "import-cat-1", label: "Nouveau", items: [{ id: "import-item-3", name: "A", price: 2 }, { id: "import-item-3", name: "B", price: 3 }] }]);
    const second = mergeMenu(first.menu, [{ id: "import-cat-1", label: "Suite", items: [{ id: "import-item-3", name: "C", price: 4 }] }]);
    const ids = second.menu.flatMap((category) => [category.id, ...category.items.map((item) => item.id)]);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("leaves the menu intact and creates no empty categories for duplicates only", () => {
    const result = mergeMenu(existing, [{ id: "a", label: "Nouveautés", items: [{ id: "b", name: "Mochi", price: 8 }] }]);
    expect(result.menu).toEqual(existing);
    expect(result.summary).toEqual({ addedItems: 0, enrichedCategories: 0, createdCategories: 0, skippedDuplicates: 1 });
  });
});