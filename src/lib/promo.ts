// Promotions : logique partagée (client = aperçu, serveur = calcul qui fait foi)
export type DiscountKind = "percent" | "fixed";
export type Marketing = {
  announcement?: { enabled: boolean; text: string };
  firstOrder?: { enabled: boolean; kind: DiscountKind; value: number; minOrder: number };
};

export function computeDiscount(kind: DiscountKind, value: number, subtotal: number) {
  const d = kind === "percent" ? (subtotal * Math.min(value, 100)) / 100 : value;
  return Math.round(Math.min(Math.max(d, 0), subtotal) * 100) / 100;
}

export const discountLabel = (kind: DiscountKind, value: number) =>
  kind === "percent" ? `-${value} %` : `-${value.toFixed(2).replace(".", ",")} €`;

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

export function announcementText(config: { marketing?: Marketing } | null | undefined) {
  const a = config?.marketing?.announcement;
  return a?.enabled && a.text.trim() ? a.text.trim() : null;
}

/** Ciblage d'un code promo : catégories et/ou articles (ids stables). Vide/null = toute la commande. */
export type PromoScope = { categories?: string[]; items?: string[] } | null | undefined;
export const isScoped = (s: PromoScope) => !!(s && ((s.categories?.length ?? 0) + (s.items?.length ?? 0)));

/** Sous-total des lignes éligibles au code ciblé. */
export function eligibleSubtotal(scope: PromoScope, lines: { id: string; total: number }[], categoryIdOf: (itemId: string) => string | undefined) {
  if (!isScoped(scope)) return Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const cats = new Set(scope!.categories ?? []);
  const items = new Set(scope!.items ?? []);
  const sum = lines.filter((l) => items.has(l.id) || cats.has(categoryIdOf(l.id) ?? "")).reduce((s, l) => s + l.total, 0);
  return Math.round(sum * 100) / 100;
}

/** Lignes du panier pour l'aperçu d'un code ciblé (le serveur recalcule à la commande). */
export function promoLines(
  catalog: { itemsById: Record<string, import("./menu").MenuItem | undefined> },
  lines: { itemId: string; qty: number; sel: import("./menu").Selections }[],
  price: (item: import("./menu").MenuItem, sel: import("./menu").Selections) => number,
) {
  return lines.flatMap((l) => { const it = catalog.itemsById[l.itemId]; return it ? [{ id: l.itemId, total: Math.round(price(it, l.sel) * l.qty * 100) / 100 }] : []; });
}
