import { describe, expect, it } from "vitest";
import { groupsFor, type OptionData } from "@/lib/menu-options";

const data: OptionData = {
  variants: [
    { id: "xl", product_id: "dish", name: "XL", price: 15, is_default: true, is_available: true, sort_order: 1 },
    { id: "solo", product_id: "dish", name: "Solo", price: 10, is_default: false, is_available: true, sort_order: 0 },
  ],
  groups: [
    { id: "sauce", name: "Sauces", min_selection: 0, max_selection: 2, is_required: false, sort_order: 1 },
    { id: "cheese", name: "Fromages", min_selection: 0, max_selection: 2, is_required: false, sort_order: 0 },
  ],
  items: [
    { id: "bbq", group_id: "sauce", name: "BBQ", price: 1, is_available: true, sort_order: 1 },
    { id: "ketchup", group_id: "sauce", name: "Ketchup", price: 0, is_available: true, sort_order: 0 },
    { id: "cheddar", group_id: "cheese", name: "Cheddar", price: 2, is_available: true, sort_order: 0 },
  ],
  links: [
    { id: "a", product_id: "dish", group_id: "sauce", variant_id: null },
    { id: "b", product_id: "dish", group_id: "cheese", variant_id: null },
  ],
};

describe("Ordre manuel des options dans tous les catalogues", () => {
  it("classe les groupes selon leur ordre et non celui des rattachements", () => {
    expect(groupsFor("dish", data).map((g) => g.id)).toEqual(["size", "og-cheese", "og-sauce"]);
  });
  it("classe les suppléments sans modifier leurs prix", () => {
    expect(groupsFor("dish", data).find((g) => g.id === "og-sauce")?.choices.map((c) => [c.id, c.price])).toEqual([["ketchup", 0], ["bbq", 1]]);
  });
  it("classe les tailles sans changer le défaut ni les prix", () => {
    expect(groupsFor("dish", data)[0]?.choices.map((c) => [c.id, c.price])).toEqual([["solo", 10], ["xl", 15]]);
    expect(data.variants[0]?.is_default).toBe(true);
  });
});