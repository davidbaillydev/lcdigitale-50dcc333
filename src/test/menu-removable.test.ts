import { describe, expect, it } from "vitest";
import { REMOVE_KEY, describeSelections, removableChoices, validateSelections, type MenuItem } from "@/lib/menu";

const dish: MenuItem = { id: "sig-beef-lok-lak", name: "Beef Lok Lak", price: 10.9, desc: "Riz sauce tomate, mélange de légumes, œuf, émincé de bœuf sauce maison" };

describe("ingrédients retirables", () => {
  it("déduit les ingrédients de la description quand rien n'est défini", () => {
    const labels = removableChoices(dish).map((c) => c.label);
    expect(labels).toContain("Œuf");
    expect(labels).toContain("Riz sauce tomate");
  });

  it("la liste personnalisée du restaurateur prime sur la description", () => {
    const custom: MenuItem = { ...dish, removable: ["Oignons", "Ciboulette"] };
    expect(removableChoices(custom).map((c) => c.label)).toEqual(["Oignons", "Ciboulette"]);
  });

  it("une liste vide interdit tout retrait", () => {
    const locked: MenuItem = { ...dish, removable: [] };
    expect(removableChoices(locked)).toEqual([]);
    expect(validateSelections(locked, { [REMOVE_KEY]: ["oeuf"] })).toBe("Ingrédient à retirer invalide");
  });

  it("accepte un retrait connu et le fait apparaître en « SANS : » pour la cuisine", () => {
    const sel = { [REMOVE_KEY]: ["oeuf"] };
    expect(validateSelections(dish, sel)).toBeNull();
    expect(describeSelections(dish, sel)).toEqual(["SANS : Œuf"]);
  });

  it("refuse un ingrédient inconnu", () => {
    expect(validateSelections(dish, { [REMOVE_KEY]: ["caviar"] })).toBe("Ingrédient à retirer invalide");
  });

  it("les plats à configurer (builder) ne proposent pas de retrait", () => {
    expect(removableChoices({ ...dish, builder: true })).toEqual([]);
  });
});
