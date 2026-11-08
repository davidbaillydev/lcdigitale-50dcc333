import { describe, expect, it, vi, beforeEach } from "vitest";
import { duplicateCatalog, duplicatePrice, duplicateRestaurantSchema, type DuplicateRestaurantInput } from "@/lib/restaurant-duplication";
import type { Category } from "@/lib/menu";
import type { OptionData } from "@/lib/menu-options";
const input: DuplicateRestaurantInput = { sourceId: "00000000-0000-4000-8000-000000000001", name: "Dakar", slug: "dakar", city: "Dakar", address: "", phone: "", email: "", country: "SN", currency: "XOF", copyMenu: true, copyBrand: true, copyOpening: false, priceMode: "keep", coefficient: 1 };
const menu: Category[] = [{ id: "cat", label: "Plats", items: [{ id: "dish", name: "Plat", desc: "Salade, tomate", removable: ["Tomate"], price: 12.5, image: "/api/public/menu-photo/source/photo.jpg", options: [{ id: "sauce", label: "Sauce", min: 0, max: 2, extraPrice: 1.5, choices: [{ id: "a", label: "A", price: 2 }, { id: "b", label: "B" }] }] }] }];
const data: OptionData = {
  groups: [{ id: "g", name: "Suppléments", min_selection: 0, max_selection: 2, is_required: false, sort_order: 1 }],
  variants: [{ id: "v", product_id: "dish", name: "XL", price: 15, is_default: true, is_available: true, sort_order: 1 }],
  items: [{ id: "o", group_id: "g", name: "Fromage", price: 2.5, is_available: true, sort_order: 1 }],
  links: [{ id: "l", product_id: "dish", group_id: "g", variant_id: "v" }],
};
const clone = (overrides: Partial<DuplicateRestaurantInput> = {}) => { let n = 0; return duplicateCatalog(menu, data, { ...input, ...overrides }, () => `new-${++n}`); };
describe("Duplication isolée", () => {
  it("conserve les prix exacts sans conversion implicite", () => { expect(duplicatePrice(12.5, input)).toBe(12.5); });
  it("réinitialise tous les prix, y compris formats, choix et supplément inclus", () => {
    const r = clone({ priceMode: "zero" });
    expect(r.menu[0]?.items[0]?.price).toBe(0);
    expect(r.menu[0]?.items[0]?.options?.[0]?.extraPrice).toBe(0);
    expect(r.menu[0]?.items[0]?.options?.[0]?.choices[0]?.price).toBe(0);
    expect(r.options.variants[0]?.price).toBe(0); expect(r.options.items[0]?.price).toBe(0);
  });
  it("multiplie toutes les sources de prix et arrondit le CFA sans décimales", () => {
    const r = clone({ priceMode: "multiply", coefficient: 655.957 });
    expect(r.menu[0]?.items[0]?.price).toBe(8199);
    expect(r.menu[0]?.items[0]?.options?.[0]?.extraPrice).toBe(984);
    expect(r.menu[0]?.items[0]?.options?.[0]?.choices[0]?.price).toBe(1312);
    expect(r.options.variants[0]?.price).toBe(9839); expect(r.options.items[0]?.price).toBe(1640);
  });
  it("arrondit EUR à deux décimales", () => { expect(duplicatePrice(12.5, { ...input, currency: "EUR", priceMode: "multiply", coefficient: 1.123 })).toBe(14.04); });
  it("garde les prix optionnels absents", () => { expect(clone({ priceMode: "zero" }).menu[0]?.items[0]?.options?.[0]?.choices[1]).not.toHaveProperty("price"); });
  it("copie descriptions et ingrédients sans muter la source", () => {
    const r = clone(); expect(r.menu[0]?.items[0]?.removable).toEqual(["Tomate"]);
    expect(r.menu[0]?.items[0]?.desc).toBe("Salade, tomate"); r.menu[0]?.items[0]?.removable?.push("Salade");
    expect(menu[0]?.items[0]?.removable).toEqual(["Tomate"]);
  });
  it("remappe les UUID et conserve les liens strictement internes", () => {
    const r = clone(); expect(r.options.groups[0]?.id).not.toBe("g");
    expect(r.options.items[0]?.group_id).toBe(r.options.groups[0]?.id);
    expect(r.options.links[0]?.group_id).toBe(r.options.groups[0]?.id);
    expect(r.options.links[0]?.variant_id).toBe(r.options.variants[0]?.id);
    expect(r.options.links[0]?.id).not.toBe("l");
  });
  it("omet les photos privées appartenant au restaurant source", () => { expect(clone().menu[0]?.items[0]).not.toHaveProperty("image"); });
  it("ne copie aucune carte ni table optionnelle lorsque décoché", () => { expect(clone({ copyMenu: false })).toEqual({ menu: [], options: { groups: [], items: [], variants: [], links: [] } }); });
  it("refuse prix hors plafond et coefficients invalides", () => {
    expect(() => duplicatePrice(999999, { ...input, priceMode: "multiply", coefficient: 2 })).toThrow("plafond");
    for (const coefficient of [0, -1, Infinity, NaN]) expect(duplicateRestaurantSchema.safeParse({ ...input, coefficient }).success).toBe(false);
  });
  it("refuse slug réservé, email invalide et données sensibles additionnelles", () => {
    for (const patch of [{ slug: "admin" }, { slug: "Nom invalide" }, { email: "incorrect" }, { members: ["source"] }, { credentials: "secret" }]) expect(duplicateRestaurantSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (f: unknown) => f }; return b; } }));
import { duplicateAgencyRestaurant } from "@/lib/restaurant-duplication.functions";
const context = { userId: "user", supabase: mocks };
const call = duplicateAgencyRestaurant as unknown as (v: { data: DuplicateRestaurantInput; context: typeof context }) => Promise<unknown>;
beforeEach(() => vi.resetAllMocks());
it.each([false, null])("refuse duplication serveur sans rôle agence (%s)", async (role) => {
  mocks.rpc.mockResolvedValue({ data: role, error: null });
  await expect(call({ data: input, context })).rejects.toThrow("administrateur agence"); expect(mocks.from).not.toHaveBeenCalled();
});
it("refuse duplication si contrôle agence échoue", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: { message: "network" } });
  await expect(call({ data: input, context })).rejects.toThrow("administrateur agence"); expect(mocks.from).not.toHaveBeenCalled();
});