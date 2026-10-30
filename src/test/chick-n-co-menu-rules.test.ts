// Chick'N Co : 2 sauces incluses puis 0,50 € par sauce supplémentaire.
import { describe, expect, it } from "vitest";
import { unitPrice, type MenuItem } from "@/lib/menu";

const sauces = ["blanche", "spicy", "golden", "green", "cocktail"].map((s) => ({ id: s, label: s, price: 0 }));
const sandwich: MenuItem = { id: "sandwich", name: "Sandwich seul", price: 7, options: [{ id: "cnc-sauces", label: "Sauces au choix", min: 0, max: 11, included: 2, extraPrice: 0.5, choices: sauces }] };
const pick = (n: number) => ({ "cnc-sauces": sauces.slice(0, n).map((s) => s.id) });

describe("Chick'N Co : sauces", () => {
  it("2 sauces sont incluses", () => expect(unitPrice(sandwich, pick(2))).toBe(7));
  it("3e sauce facturée 0,50 €", () => expect(unitPrice(sandwich, pick(3))).toBe(7.5));
  it("5 sauces = 1,50 € de supplément", () => expect(unitPrice(sandwich, pick(5))).toBe(8.5));
});
