import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { unitPrice, type Selections } from "./menu";
import { getCatalog, type Catalog } from "./catalogs";
import type { Restaurant } from "./shop";
import { useSoldOut } from "./stock";
import { withOptions } from "./menu-options";
import { useOptionData } from "./menu-options-live";
import { useQrMode, type QrMode } from "./table";

export type CartLine = { key: string; itemId: string; qty: number; sel: Selections; note?: string };
type Ctx = {
  restaurant: Restaurant;
  catalog: Catalog;
  qr: QrMode;
  lines: CartLine[];
  add: (itemId: string, sel: Selections, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};
const CartCtx = createContext<Ctx | null>(null);

/** Panier propre à chaque restaurant (stocké séparément sur l'appareil) */
export function CartProvider({ restaurant, children }: { restaurant: Restaurant; children: ReactNode }) {
  const soldOut = useSoldOut(restaurant.id);
  const qr = useQrMode(restaurant.slug, restaurant.config.qr);
  const { data: options } = useOptionData(restaurant.id);
  const catalog = useMemo<Catalog>(() => {
    const base = withOptions(getCatalog(restaurant), options);
    if (!soldOut.size) return base;
    const categories = base.categories.map((c) => ({ ...c, items: c.items.filter((i) => !soldOut.has(i.id)) })).filter((c) => c.items.length);
    return { categories, itemsById: Object.fromEntries(categories.flatMap((c) => c.items.map((i) => [i.id, i]))) };
  }, [restaurant, soldOut, options]);
  const KEY = `cart-v2-${restaurant.slug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setLines(raw ? (JSON.parse(raw) as CartLine[]).filter((l) => catalog.itemsById[l.itemId]) : []);
    } catch {}
    setReady(true);
  }, [KEY, catalog]);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, KEY, ready]);

  const value = useMemo<Ctx>(() => {
    const subtotal = lines.reduce((s, l) => {
      const it = catalog.itemsById[l.itemId];
      return it ? s + unitPrice(it, l.sel) * l.qty : s;
    }, 0);
    return {
      restaurant,
      catalog,
      qr,
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: Math.round(subtotal * 100) / 100,
      add: (itemId, sel, qty = 1) =>
        setLines((prev) => {
          const key = itemId + JSON.stringify(sel);
          const ex = prev.find((l) => l.key === key);
          if (ex) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
          return [...prev, { key, itemId, sel, qty }];
        }),
      setQty: (key, qty) =>
        setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)))),
      clear: () => setLines([]),
    };
  }, [lines, restaurant, catalog, qr]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
