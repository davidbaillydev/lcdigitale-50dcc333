import type { Catalog } from "./catalogs";
import { orderLine, validateSelections, type Selections } from "./menu";

export type SimulationLine = { key: string; itemId: string; qty: number; sel: Selections };
export type SimulationOrder = { id: string; createdAt: string; items: ReturnType<typeof orderLine>[]; total: number; note: string; test: true };

/** Pure local snapshot: deliberately has no order, payment, storage or analytics dependencies. */
export function simulateOrder(catalog: Catalog, lines: SimulationLine[], number: number, note = ""): SimulationOrder {
  if (!lines.length) throw new Error("Le panier est vide");
  const items = lines.map((line) => {
    const item = catalog.itemsById[line.itemId];
    if (!item) throw new Error("Plat indisponible dans cette carte");
    if (!Number.isInteger(line.qty) || line.qty < 1) throw new Error("Quantité invalide");
    const error = validateSelections(item, line.sel);
    if (error) throw new Error(error);
    return orderLine(item, line.sel, line.qty);
  });
  return { id: `TEST-${String(number).padStart(3, "0")}`, createdAt: new Date().toISOString(), items, total: Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100, note, test: true };
}