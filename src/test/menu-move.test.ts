import { describe, expect, it } from "vitest";
import { moveMenuItem } from "@/lib/menu-move";
import type { Category, MenuItem } from "@/lib/menu";

const dish: MenuItem = {
  id: "dish", name: "Poulet", price: 12.5, desc: "Maison", hidden: true,
  image: "/api/public/menu-photo/restaurant/photo.jpg", allergens: ["lait"], vatRate: 10,
  schedule: { days: [1], start: "12:00", end: "14:00" }, removable: ["Oignons"],
  translations: { en: { name: "Chicken" } },
  options: [{ id: "sauce", label: "Sauce", min: 1, max: 1, choices: [{ id: "curry", label: "Curry", price: 1 }] }],
};
const menu: Category[] = [
  { id: "source", label: "Plats", note: "Maison", items: [dish] },
  { id: "destination", label: "Spécialités", items: [{ id: "other", name: "Riz", price: 3 }] },
  { id: "empty", label: "Nouveautés", items: [] },
];

describe("moving dishes between existing categories", () => {
  it("removes the dish from its source and appends it once to the destination without changing any settings", () => {
    const before = structuredClone(menu);
    const next = moveMenuItem(menu, "source", "dish", "destination");
    expect(next[0]).toEqual({ ...menu[0], items: [] });
    expect(next[1]?.items.map((item) => item.id)).toEqual(["other", "dish"]);
    expect(next[1]?.items[1]).toBe(dish);
    expect(next[2]).toBe(menu[2]);
    expect(menu).toEqual(before);
    expect(next.flatMap((category) => category.items)).toHaveLength(2);
  });
  it("allows an empty existing destination without deleting or reordering categories", () => {
    const next = moveMenuItem(menu, "source", "dish", "empty");
    expect(next.map((category) => category.id)).toEqual(["source", "destination", "empty"]);
    expect(next[2]?.items).toEqual([dish]);
  });
  it.each([
    ["source", "dish", "source"], ["missing", "dish", "destination"],
    ["source", "missing", "destination"], ["source", "dish", "missing"],
  ])("leaves the draft intact for invalid or unchanged destinations (%s, %s, %s)", (source, item, destination) => {
    expect(moveMenuItem(menu, source, item, destination)).toBe(menu);
  });
  it("does not duplicate an item already present in the destination", () => {
    const duplicate = [...menu, { id: "duplicate", label: "Duplicate", items: [dish] }];
    expect(moveMenuItem(duplicate, "source", "dish", "duplicate")).toBe(duplicate);
  });
});