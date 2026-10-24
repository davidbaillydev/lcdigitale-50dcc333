import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/catalogs";
import { simulateOrder } from "@/lib/menu-simulation";

const menu = [{ id: "plats", label: "Plats", items: [{ id: "plat", name: "Plat modifié", price: 9, options: [{ id: "extra", label: "Sauce", min: 1, max: 1, choices: [{ id: "sauce", label: "Sauce", price: 2 }] }] }] }];
const catalog = getCatalog({ menu_key: "vierge", menu });
describe("isolated menu simulation", () => {
  it("uses the modified menu and computes options without payment", () => {
    const order = simulateOrder(catalog, [{ key: "x", itemId: "plat", qty: 2, sel: { extra: ["sauce"] } }], 1);
    expect(order.total).toBe(22);
    expect(order.items[0]?.name).toBe("Plat modifié");
    expect(order.id).toBe("TEST-001");
    expect(order.test).toBe(true);
  });
  it("rejects missing required selections", () => {
    expect(() => simulateOrder(catalog, [{ key: "x", itemId: "plat", qty: 1, sel: {} }], 1)).toThrow("1 choix minimum");
  });
  it("keeps previous orders unchanged when the draft changes", () => {
    const order = simulateOrder(catalog, [{ key: "x", itemId: "plat", qty: 1, sel: { extra: ["sauce"] } }], 1);
    const changed = getCatalog({ menu_key: "vierge", menu: [{ id: "plats", label: "Plats", items: [{ id: "plat", name: "Autre nom", price: 30 }] }] });
    expect(simulateOrder(changed, [{ key: "x", itemId: "plat", qty: 1, sel: {} }], 2).total).toBe(30);
    expect(order.total).toBe(11);
    expect(order.items[0]?.name).toBe("Plat modifié");
  });
  it("rejects an empty order", () => { expect(() => simulateOrder(catalog, [], 1)).toThrow("Le panier est vide"); });
});