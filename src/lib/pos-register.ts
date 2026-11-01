/** Caisse comptoir (POS) intégrée — helpers purs partagés client/serveur. */
import { featuresOf } from "./features";

export type PosTenderMethod = "cash" | "card" | "meal_voucher";
export type PosTender = { method: PosTenderMethod; given?: number; change?: number };

export const POS_TENDER_LABELS: Record<PosTenderMethod, string> = { cash: "Espèces", card: "Carte bancaire", meal_voucher: "Titres restaurant" };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Caisse activée par le module d'abonnement `pos` (opt-in strict : `enabled_features.pos === true`),
 * ou par l'ancien réglage `config.pos.enabled === true` conservé pour compatibilité.
 * Absent des deux = désactivé : les restaurants existants restent sur Hiboutik.
 */
export function posEnabled(r: { config?: unknown; enabled_features?: unknown } | null | undefined): boolean {
  const c = (r?.config ?? {}) as { pos?: { enabled?: unknown } };
  return featuresOf(r?.enabled_features).pos || c.pos?.enabled === true;
}

/** Rendu de monnaie ; null si la somme remise est insuffisante. */
export function changeDue(total: number, given: number): number | null {
  if (!Number.isFinite(given) || given + 1e-9 < total) return null;
  return r2(given - total);
}

/** Correspondance avec la colonne orders.payment_method existante. */
export function posPaymentMethod(m: PosTenderMethod): "counter" | "card_terminal" {
  return m === "card" ? "card_terminal" : "counter";
}

export type ZOrder = { total: number; status: string; pos_tender: PosTender | null };
export type ZReport = {
  orders: number;
  cancelled: number;
  total: number;
  byMethod: Record<PosTenderMethod, { count: number; amount: number }>;
  openingFloat: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
};

/** Ticket Z : totaux par mode de règlement et écart de caisse espèces. */
export function zReport(orders: ZOrder[], openingFloat: number, countedCash: number | null): ZReport {
  const byMethod = { cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 }, meal_voucher: { count: 0, amount: 0 } };
  let n = 0, cancelled = 0, total = 0;
  for (const o of orders) {
    if (o.status === "cancelled") { cancelled++; continue; }
    const m = o.pos_tender?.method ?? "cash";
    byMethod[m].count++; byMethod[m].amount = r2(byMethod[m].amount + o.total);
    n++; total = r2(total + o.total);
  }
  const expectedCash = r2(openingFloat + byMethod.cash.amount);
  return { orders: n, cancelled, total, byMethod, openingFloat: r2(openingFloat), expectedCash, countedCash, cashDifference: countedCash == null ? null : r2(countedCash - expectedCash) };
}
