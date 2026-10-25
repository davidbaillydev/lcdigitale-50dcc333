import { describe, expect, it } from "vitest";
import { itemTitle, ticketOptions, type TicketOrder, type TicketShop } from "@/lib/ticket";

const item: TicketOrder["items"][number] = {
  id: "tacos", name: "TACOS simple", qty: 1,
  size: { id: "m", name: "Moyen" },
  selected_options: [{ id: "fries", name: "Frites", price: 1 }, { id: "yes", name: "Oui", price: 0 }, { id: "white", name: "sauce blanche", price: 0 }, { id: "brazil", name: "Brazilienne", price: 0 }],
};
const shop: TicketShop = { name: "Test", optionData: {
  variants: [],
  groups: ["Choix", "Sauce fromagère", "Sauces"].map((name, i) => ({ id: `g${i}`, name, min_selection: 0, max_selection: 3, is_required: false, sort_order: i })),
  items: [ ["fries", "g0"], ["yes", "g1"], ["white", "g2"], ["brazil", "g2"] ].map(([id, group_id]) => ({ id: id ?? "", group_id: group_id ?? "", name: "Renamed in catalog", price: 99, is_available: true, sort_order: 0 })),
  links: [0, 1, 2].map((i) => ({ id: `l${i}`, product_id: "tacos", group_id: `g${i}`, variant_id: null })),
} };

describe("reference ticket choice presentation", () => {
  it("keeps the commercial name and selected format unchanged", () => {
    expect(itemTitle(item)).toBe("TACOS simple [Moyen]");
    expect(itemTitle({ name: "TACOS simple" })).toBe("TACOS simple");
  });
  it("restores group labels by IDs, one choice per line, preserving snapshot prices and names", () => {
    expect(ticketOptions(item, shop)).toEqual(["Choix: Frites (+1,00 €)", "Sauce fromagère: Oui", "Sauces: sauce blanche", "Sauces: Brazilienne"]);
    expect(item.selected_options?.[0]).toEqual({ id: "fries", name: "Frites", price: 1 });
  });
  it("does not invent a group for missing IDs or another product", () => {
    expect(ticketOptions({ ...item, id: "other" }, shop)).toEqual(["Oui", "sauce blanche", "Brazilienne", "+ Frites (+1,00 €)"]);
  });
  it("keeps labels already recorded and separates multiple grouped choices", () => {
    expect(ticketOptions({ name: "Tacos", qty: 1, details: ["Sauces : blanche, Brazilienne", "1 Viande: Kebab"] })).toEqual(["Sauces: blanche", "Sauces: Brazilienne", "1 Viande: Kebab"]);
  });
  it("does not guess an ambiguous group", () => {
    const data = shop.optionData;
    if (!data) throw new Error("Missing fixture");
    const ambiguous = { ...shop, optionData: { ...data, items: [...data.items, { id: "white", group_id: "g1", name: "white", price: 0, is_available: true, sort_order: 0 }] } };
    expect(ticketOptions(item, ambiguous)).toContain("sauce blanche");
  });
});