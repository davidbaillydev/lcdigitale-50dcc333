import { describe, expect, it } from "vitest";
import menu from "./fixtures/chick-n-co-menu.json";
import { orderLine, unitPrice, type Category, type MenuItem } from "@/lib/menu";

const categories = menu as Category[];
const items = categories.flatMap((c) => c.items);
function item(id: string): MenuItem {
  const found = items.find((i) => i.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}

describe("Chick'N Co source priority", () => {
  it.each([["import-item-2", 14], ["import-item-34", 16.5]])("uses FoodBooking XL price in server order lines: %s", (id, expected) => {
    const line = orderLine(item(String(id)), { "cnc-taille": ["cnc-taille-2"] }, 2);
    expect(line.unit).toBe(expected);
    expect(line.total).toBe(Number(expected) * 2);
  });
  it.each([39, 40, 41, 42, 43])("keeps four PDF pieces on item %i", (n) => {
    expect(item(`import-item-${n}`).desc).toBe("4 pièces.");
    expect(item(`import-item-${n}`).price).toBe(4.9);
  });
  it.each([44, 45])("does not import FoodBooking x4 for unreadable PDF item %i", (n) => {
    expect(item(`import-item-${n}`).desc).toBeUndefined();
  });
  it("keeps PDF soft formats, without importing FoodBooking brands or 1.25L", () => {
    const softs = items.filter((i) => ["import-item-56", "import-item-57", "import-item-58"].includes(i.id));
    expect(softs.map((i) => [i.name, i.price])).toEqual([["Soft 33 cl", 2], ["Bouteille de soft 50 cl", 2.5], ["Bouteille de soft 1,5 l", 4]]);
    expect(softs.every((i) => !i.options?.length)).toBe(true);
    expect(item("import-item-49").desc).toContain("Capri-Sun");
    for (const i of items) for (const g of i.options ?? []) if (g.id === "cnc-boisson") expect(g.choices.map((c) => c.label)).toEqual(["Soft 33 cl"]);
  });
  it("keeps PDF category splits and signature supplements", () => {
    expect(categories.map((c) => c.label)).toEqual(["Tacos", "Sandwichs", "Burgers", "Assiettes", "Sandwichs signatures", "Burgers signatures", "Salades", "Tex-Mex", "Menus", "Desserts", "Boissons"]);
    expect(item("import-item-10").options?.find((g) => g.id === "cnc-signature-extra")?.choices.map((c) => c.label)).toEqual(["Roquefort", "Raclette", "Chèvre", "Crème cheddar", "Miel", "Œuf", "Bacon"]);
  });
  it.each([16, 17])("uses PDF brochette labels on plate %i", (n) => {
    expect(item(`import-item-${n}`).options?.find((g) => g.id === "cnc-viandes")?.choices.map((c) => c.label)).toEqual(["Kebab", "Poulet tikka", "Poulet tandoori", "Tenders", "Cordon bleu", "Brochette de keema", "Brochette de kefta", "Steak haché", "Falafel"]);
  });
  it.each([2, 4, 7, 8, 9, 10, 11, 12, 13, 14])("offers the PDF sweet-potato supplement on standalone item %i", (n) => {
    const product = item(`import-item-${n}`);
    expect(unitPrice(product, { "cnc-patates-douces": ["cnc-patates-douces-0"] })).toBe(product.price + 1);
  });
  it("keeps two sauces included then charges each additional sauce on every configured item", () => {
    const configured = items.filter((i) => i.options?.some((g) => g.id === "cnc-sauces"));
    expect(configured).toHaveLength(9);
    for (const product of configured) {
      const base = unitPrice(product, {});
      expect(unitPrice(product, { "cnc-sauces": ["cnc-sauces-0", "cnc-sauces-1"] })).toBe(base);
      expect(orderLine(product, { "cnc-sauces": ["cnc-sauces-0", "cnc-sauces-1", "cnc-sauces-2", "cnc-sauces-3"] }, 1).unit).toBe(base + 1);
    }
  });
  it("does not declare unverified allergens", () => {
    expect(items.every((i) => i.allergens === undefined)).toBe(true);
  });
});