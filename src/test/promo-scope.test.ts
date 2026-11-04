import { describe, it, expect } from "vitest";
import { eligibleSubtotal, computeDiscount } from "@/lib/promo";

const cat = (id: string) => ({ s1: "sushis", s2: "sushis", b1: "boissons" } as Record<string, string>)[id];
const lines = [{ id: "s1", total: 10 }, { id: "s2", total: 6 }, { id: "b1", total: 4 }];

describe("codes promo ciblés", () => {
  it("sans ciblage, toute la commande", () => expect(eligibleSubtotal(null, lines, cat)).toBe(20));
  it("par catégorie", () => expect(eligibleSubtotal({ categories: ["sushis"], items: [] }, lines, cat)).toBe(16));
  it("par article précis", () => expect(eligibleSubtotal({ categories: [], items: ["b1"] }, lines, cat)).toBe(4));
  it("pourcentage sur la catégorie seulement", () => expect(computeDiscount("percent", 20, eligibleSubtotal({ categories: ["sushis"] }, lines, cat))).toBe(3.2));
  it("montant fixe plafonné aux articles concernés", () => expect(computeDiscount("fixed", 10, eligibleSubtotal({ items: ["b1"] }, lines, cat))).toBe(4));
});
