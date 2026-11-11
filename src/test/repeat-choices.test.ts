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
