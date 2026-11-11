import { describe, it, expect } from "vitest";
import { adjustChoice, countChoices } from "@/lib/menu";
describe("choix répétés", () => {
  it("permet Poulet x2 quand max = 2", () => {
    expect(adjustChoice(2, ["poulet"], "poulet", 1)).toEqual(["poulet", "poulet"]);
  });
  it("bloque au-delà du max", () => {
    expect(adjustChoice(2, ["poulet", "poulet"], "tenders", 1)).toEqual(["poulet", "poulet"]);
  });
  it("retire un seul exemplaire", () => {
    expect(adjustChoice(3, ["poulet", "tenders", "poulet"], "poulet", -1)).toEqual(["poulet", "tenders"]);
  });
  it("regroupe pour le ticket", () => {
    expect(countChoices(["poulet", "poulet", "tenders"])).toEqual([["poulet", 2], ["tenders", 1]]);
  });
});
import { validateSelections, type MenuItem } from "@/lib/menu";
describe("validation tacos 3 viandes", () => {
  const item = { id: "t", name: "Tacos XXL", price: 12, options: [{ id: "v", label: "Viandes", min: 3, max: 3, choices: [{ id: "kebab", label: "Kebab" }, { id: "tender", label: "Tender" }] }] } as unknown as MenuItem;
  it("accepte 2 kebab + 1 tender", () => expect(validateSelections(item, { v: ["kebab", "kebab", "tender"] })).toBeNull());
  it("refuse 4 viandes", () => expect(validateSelections(item, { v: ["kebab", "kebab", "kebab", "tender"] })).not.toBeNull());
});
