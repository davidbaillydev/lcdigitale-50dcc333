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
