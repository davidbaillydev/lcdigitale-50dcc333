import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ITEMS_BY_ID, unitPrice, type Selections } from "./menu";

export type CartLine = { key: string; itemId: string; qty: number; sel: Selections; note?: string };
type Ctx = {
  lines: CartLine[];
  add: (itemId: string, sel: Selections, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = "wns-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines((JSON.parse(raw) as CartLine[]).filter((l) => ITEMS_BY_ID[l.itemId]));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<Ctx>(() => {
    const subtotal = lines.reduce((s, l) => s + unitPrice(ITEMS_BY_ID[l.itemId]!, l.sel) * l.qty, 0);
    return {
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
  }, [lines]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
