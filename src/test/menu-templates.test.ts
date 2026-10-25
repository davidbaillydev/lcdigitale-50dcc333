import { describe, expect, it } from "vitest";
import { applyStructure, captureStructure } from "@/lib/menu-templates";
import { EMPTY_OPTIONS } from "@/lib/menu-options";
import { mergeMenu } from "@/lib/menu-merge";
import { lineUnitPrice } from "@/lib/menu";
import type { Category } from "@/lib/menu";

const template: Category[] = [{ id: "tacos", label: "Tacos", items: [{ id: "source", name: "Tacos modèle", price: 0, builder: true, options: [
  { id: "size", label: "Format", kind: "size", min: 1, max: 1, choices: [{ id: "solo", label: "Seul", price: 8 }, { id: "menu", label: "Menu", price: 12 }] },
  { id: "meat", label: "Viandes", min: 1, max: 2, choices: [{ id: "chicken", label: "Poulet" }] },
  { id: "drink", label: "Boisson", min: 1, max: 1, forSize: "menu", choices: [{ id: "cola", label: "Cola" }] },
] }] }];
const imported: Category[] = [{ id: "cat", label: "Nouveautés", items: [{ id: "new", name: "Tacos maison", price: 10, allergens: ["gluten"], desc: "Recette maison" }, { id: "other", name: "Salade", price: 6 }] }];
const mapping = [{ itemId: "new", sourceId: "source" }];
describe("restaurant menu structures", () => {
  it("preserves imported dishes and prices without copying source dishes", () => {
    const next = applyStructure(imported, template, mapping);
    expect(next.applied).toBe(1);
    expect(next.menu[0]?.items[0]).toMatchObject({ name: "Tacos maison", price: 10, allergens: ["gluten"], desc: "Recette maison", builder: true });
    expect(next.menu[0]?.items[1]).toEqual(imported[0]?.items[1]);
    expect(next.menu[0]?.items.map((i) => i.name)).not.toContain("Tacos modèle");
  });
  it("copies formats, meats and menu-only drink with detached ids", () => {
    const item = applyStructure(imported, template, mapping).menu[0]?.items[0];
    expect(item?.options?.map((g) => g.label)).toEqual(["Format", "Viandes", "Boisson"]);
    expect(item?.options?.[2]?.forSize).toBe("tpl-0-1");
    expect(item?.options?.[0]?.choices.map((c) => c.price)).toEqual([10, 10]);
    expect(item?.options?.[1]?.choices[0]?.price).toBe(0);
  });
  it("only copies source format prices when explicitly requested", () => {
    const item = applyStructure(imported, template, mapping, true).menu[0]?.items[0];
    expect(item?.price).toBe(10);
    if (!item) throw new Error("missing item");
    expect(lineUnitPrice(item, { "tpl-0": ["tpl-0-1"] })).toBe(12);
  });
  it("organizes selected dishes into model categories and keeps unmapped dishes", () => {
    const result = applyStructure(imported, template, mapping, false, true);
    expect(result.menu.map((c) => c.label)).toEqual(["Tacos", "Nouveautés"]);
    expect(result.menu[0]?.items.map((i) => i.name)).toEqual(["Tacos maison"]);
    expect(result.menu[1]?.items.map((i) => i.name)).toEqual(["Salade"]);
  });
  it("does not mutate inputs and keeps generated category ids collision-free", () => {
    const before = structuredClone({ imported, template });
    const result = applyStructure([{ ...imported[0], id: "template-cat-1", label: "Nouveautés", items: imported[0]?.items ?? [] }], template, mapping, false, true);
    expect(result.menu[0]?.id).toBe("template-cat-2");
    expect({ imported, template }).toEqual(before);
    const target = result.menu[0]?.items[0]?.options?.[0]?.choices[0];
    if (target) target.label = "Changed";
    expect(template[0]?.items[0]?.options?.[0]?.choices[0]?.label).toBe("Seul");
  });
  it("captures normalized formats but excludes photos, descriptions, schedules and sold-out state", () => {
    const result = captureStructure([{ id: "c", label: "Tacos", items: [{ id: "p", name: "Tacos", price: 99, image: "/private.jpg", desc: "Secret", schedule: { days: [1] } }] }], { ...EMPTY_OPTIONS, variants: [{ id: "v", product_id: "p", name: "Menu", price: 12, is_available: false, is_default: false, sort_order: 0 }] });
    expect(result[0]?.items[0]?.price).toBe(0);
    expect(result[0]?.items[0]).not.toHaveProperty("image");
    expect(result[0]?.items[0]).not.toHaveProperty("schedule");
    expect(result[0]?.items[0]?.options?.[0]?.choices[0]).toEqual({ id: "v", label: "Menu", price: 12 });
  });
  it("merges configured imports without changing existing products", () => {
    const existing: Category[] = [{ id: "old", label: "Tacos", items: [{ id: "old-item", name: "Ancien", price: 7 }] }];
    const result = mergeMenu(existing, applyStructure(imported, template, mapping, false, true).menu);
    expect(result.menu[0]?.items[0]).toEqual(existing[0]?.items[0]);
    expect(result.menu[0]?.items[1]?.options?.[2]?.forSize).toBe("tpl-0-1");
  });
});