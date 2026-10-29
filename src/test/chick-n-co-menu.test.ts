import { describe, expect, it } from "vitest";
import menu from "./fixtures/chick-n-co-menu.json";
import { unitPrice, validateSelections, type MenuItem, type Selections } from "@/lib/menu";

function item(id: string): MenuItem {
  const found = menu.flatMap((c) => c.items).find((i) => i.id === id);
  if (!found) throw new Error(`Missing item ${id}`);
  return found as MenuItem;
}
describe("Chick'N Co PDF pricing", () => {
  it.each([["import-item-2", 7, 9.5, 12.5], ["import-item-34", 9, 11.5, 14.5]])("prices tacos sizes for %s", (id, m, l, xl) => {
    const taco = item(String(id));
    expect([0, 1, 2].map((n) => unitPrice(taco, { "cnc-taille": [`cnc-taille-${n}`] }))).toEqual([m, l, xl]);
  });
  it.each([1, 2, 3])("requires %i meats for the corresponding tacos size", (n) => {
    const taco = item("import-item-2");
    const sel: Selections = { "cnc-taille": [`cnc-taille-${n - 1}`], [`cnc-viandes-${n}`]: Array.from({ length: n }, (_, j) => `cnc-viandes-${n}-${j}`) };
    expect(validateSelections(taco, sel)).toBeNull();
    sel[`cnc-viandes-${n}`] = (sel[`cnc-viandes-${n}`] ?? []).slice(1);
    expect(validateSelections(taco, sel)).not.toBeNull();
  });
  it("charges tacos gratiné 2.50 and cheddar 1", () => {
    expect(unitPrice(item("import-item-2"), { "cnc-taille": ["cnc-taille-0"], "cnc-gratine": ["cnc-gratine-0"], "cnc-tacos-extra": ["cnc-tacos-extra-0"] })).toBe(10.5);
  });
  it("includes two sauces and charges 0.50 for a third", () => {
    const sandwich = item("import-item-4");
    expect(unitPrice(sandwich, { "cnc-sauces": ["cnc-sauces-0", "cnc-sauces-1"] })).toBe(7);
    expect(unitPrice(sandwich, { "cnc-sauces": ["cnc-sauces-0", "cnc-sauces-1", "cnc-sauces-2"] })).toBe(7.5);
  });
  it("charges sandwich meat 2 and chef salad 1", () => {
    expect(unitPrice(item("import-item-4"), { "cnc-viande-extra": ["cnc-viande-extra-0"], "cnc-crudites": ["cnc-crudites-5"] })).toBe(10);
  });
  it.each([["import-item-7", 7], ["import-item-24", 9.9], ["import-item-8", 9], ["import-item-25", 12], ["import-item-9", 7], ["import-item-26", 9.9], ["import-item-10", 12], ["import-item-28", 14.9], ["import-item-12", 14.5], ["import-item-30", 17.9]])("preserves the PDF burger price for %s", (id, price) => {
    expect(unitPrice(item(String(id)), {})).toBe(price);
  });
  it("charges classic burger meat 2.50 and egg 1", () => {
    expect(unitPrice(item("import-item-7"), { "cnc-burger-viande": ["cnc-burger-viande-0"], "cnc-burger-extra": ["cnc-burger-extra-0"] })).toBe(10.5);
  });
  it("charges the menu sweet potato replacement 1", () => {
    expect(unitPrice(item("import-item-24"), { "cnc-frites": ["cnc-frites-1"] })).toBe(10.9);
  });
  it("requires three meats on the mixed plate and keeps its price 15.90", () => {
    const mixed = item("import-item-17");
    expect(validateSelections(mixed, { "cnc-viandes": ["cnc-viandes-0", "cnc-viandes-1"], "cnc-accompagnement": ["cnc-accompagnement-0"] })).not.toBeNull();
    expect(validateSelections(mixed, { "cnc-viandes": ["cnc-viandes-0", "cnc-viandes-1", "cnc-viandes-2"], "cnc-accompagnement": ["cnc-accompagnement-0"] })).toBeNull();
    expect(unitPrice(mixed, {})).toBe(15.9);
  });
  it("adds the veggie plate at 11.50", () => {
    expect(unitPrice(item("cnc-assiette-veggie"), {})).toBe(11.5);
  });
  it.each([0, 1, 2])("keeps the student menu at 8 for choice %i", (n) => {
    expect(unitPrice(item("import-item-50"), { "cnc-etudiant-plat": [`cnc-etudiant-plat-${n}`] })).toBe(8);
  });
});