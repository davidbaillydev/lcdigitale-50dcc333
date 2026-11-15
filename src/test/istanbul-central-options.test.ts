import { describe, expect, it } from "vitest";
import fixture from "./fixtures/istanbul-central-options.json";
import { groupsFor, type OptionData } from "@/lib/menu-options";
import { activeGroups, type MenuItem } from "@/lib/menu";

const data: OptionData = fixture.options;

describe("Istanbul centralized menu options", () => {
  it("keeps the existing absolute formula prices", () => {
    expect(groupsFor("import-item-2", data)[0]?.choices.map(c => c.price)).toEqual([7.5, 8.5, 9.5]);
    expect(groupsFor("import-item-28", data)[0]?.choices.map(c => c.price)).toEqual([10.5, 11.5, 12.5]);
    expect(groupsFor("import-item-29", data)[0]?.choices.map(c => c.price)).toEqual([15, 16, 17]);
  });

  it.each([["import-item-2", 1], ["import-item-28", 2], ["import-item-29", 3]] as const)("requires %s's meat count in every formula", (id, count) => {
    const options = groupsFor(id, data);
    const item: MenuItem = { id, name: "Tacos", price: 0, options };
    for (const variant of options[0]?.choices ?? []) {
      const meat = activeGroups(item, { size: [variant.id] }).find(g => g.label.includes("Viandes"));
      expect([meat?.min, meat?.max, meat?.choices.length]).toEqual([count, count, 10]);
    }
  });

  it("only requires the sandwich drink for its menu formula", () => {
    const options = groupsFor("import-item-4", data);
    const item: MenuItem = { id: "import-item-4", name: "Sandwich", price: 7.5, options };
    const active = (index: number) => activeGroups(item, { size: [options[0]?.choices[index]?.id ?? ""] });
    expect(active(0).some(g => g.label === "Boissons")).toBe(false);
    expect(active(1).some(g => g.label === "Boissons")).toBe(false);
    expect(active(2).find(g => g.label === "Boissons")?.min).toBe(1);
  });

  it("requires the included drink for tenders without a format", () => {
    const drink = groupsFor("import-item-21", data).find(g => g.label === "Boissons");
    expect([drink?.min, drink?.max, drink?.forSize]).toEqual([1, 1, undefined]);
  });

  it("preserves the naan supplement prices", () => {
    expect(groupsFor("import-item-32", data).find(g => g.label === "Suppléments pain")?.choices.map(c => c.price)).toEqual([1.5, 2]);
  });
});