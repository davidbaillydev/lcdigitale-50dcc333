/** Caisse comptoir (POS) intégrée — helpers purs partagés client/serveur. */
import { featuresOf } from "./features";
import type { VatRow } from "./ticket-vat";

export type PosTenderMethod = "cash" | "card" | "meal_voucher";
export type PosTender = { method: PosTenderMethod; given?: number; change?: number };
export type PosPayment = PosTender & { amount: number };
export type PosDiscount = { type: "percent" | "fixed"; value: number; reason: string };
export function directDiscount(subtotal: number, discount?: PosDiscount | null): number {
  if (!discount) return 0;
  if (discount.reason.trim().length < 3 || !Number.isFinite(discount.value) || discount.value <= 0 || (discount.type === "percent" && discount.value > 100)) throw new Error("Remise et motif invalides.");
  const amount = r2(discount.type === "percent" ? subtotal * discount.value / 100 : discount.value);
  if (amount > subtotal) throw new Error("La remise dépasse le panier.");
  return amount;
}
export function validatePosPayments(total: number, payments: PosPayment[]): PosPayment[] {
  if (!payments.length || payments.length > 10) throw new Error("Règlements manquants.");
  const rows = payments.map((p) => {
    if (!Number.isFinite(p.amount) || p.amount <= 0 || r2(p.amount) !== p.amount) throw new Error("Montant de règlement invalide.");
    if (p.method !== "cash") return { method: p.method, amount: p.amount };
    const given = p.given ?? p.amount; const change = changeDue(p.amount, given);
    if (change == null) throw new Error("Montant remis insuffisant.");
    return { method: p.method, amount: p.amount, given, change };
  });
  if (r2(rows.reduce((s, p) => s + p.amount, 0)) !== r2(total)) throw new Error("Les règlements doivent couvrir exactement le total.");
  return rows;
}
export function paymentRemaining(total: number, payments: PosPayment[]): number { return r2(total - payments.reduce((s, p) => s + p.amount, 0)); }
export function posMonthlyCsv(rows: PosClosure[], month: string): string {
  const filtered = rows.filter((r) => r.closed_at && new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(new Date(r.closed_at)) === month);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const money = (n: number) => n.toFixed(2).replace(".", ",");
  const header = ["Z", "Clôture", "Espèces", "CB", "Titres restaurant", "Remises", "Annulations", "Entrées", "Sorties", "HT total", ...[5.5,10,20].flatMap((r) => [`HT ${r}%`, `TVA ${r}%`, `TTC ${r}%`]), "Autres HT", "Autres TVA", "Autres TTC", "TTC total", "Écart espèces", "TVA non ventilée"];
  return "\uFEFF" + [header, ...filtered.map((row) => {
    const r = row.z_report as ZReport; const vat = r.vat ?? []; const others = vat.filter((v) => ![5.5,10,20].includes(v.rate));
    const sum = (vs: VatRow[], k: "ht" | "vat" | "ttc") => vs.reduce((s, v) => s + v[k], 0);
    return [row.z_number,row.closed_at,money(r.byMethod.cash.amount),money(r.byMethod.card.amount),money(r.byMethod.meal_voucher.amount),money(r.discountTotal ?? 0),money(r.cancelledAmount ?? 0),money(r.cashIn ?? 0),money(r.cashOut ?? 0),money(sum(vat,"ht")),...[5.5,10,20].flatMap((rate) => ["ht","vat","ttc"].map((k) => money(sum(vat.filter((v) => v.rate === rate),k as "ht" | "vat" | "ttc")))),money(sum(others,"ht")),money(sum(others,"vat")),money(sum(others,"ttc")),money(r.total),money(r.cashDifference ?? 0),r.vatMissing ?? (r.vat ? 0 : r.orders)];
  })].map((r) => r.map(cell).join(";")).join("\r\n");
}

export const POS_TENDER_LABELS: Record<PosTenderMethod, string> = { cash: "Espèces", card: "Carte bancaire", meal_voucher: "Titres restaurant" };
export const CASH_QUICK_AMOUNTS = [5, 10, 20, 50] as const;

export type PosClosure = { z_number: number | null; opened_at: string; closed_at: string | null; z_report: unknown };

/** Export exhaustif du journal, valeurs numériques françaises et champs CSV échappés. */
export function posClosuresCsv(rows: PosClosure[]): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const money = (v: number | null) => v == null ? "" : v.toFixed(2).replace(".", ",");
  const header = ["Numéro Z", "Ouverture", "Clôture", "Ventes", "Annulées", "Total TTC", "Espèces", "Carte bancaire", "Titres restaurant", "Fond de caisse", "Espèces attendues", "Espèces comptées", "Écart espèces"];
  return "\uFEFF" + [header, ...rows.map((row) => {
    const r = row.z_report as ZReport;
    return [row.z_number, row.opened_at, row.closed_at, r.orders, r.cancelled, money(r.total), money(r.byMethod.cash.amount), money(r.byMethod.card.amount), money(r.byMethod.meal_voucher.amount), money(r.openingFloat), money(r.expectedCash), money(r.countedCash), money(r.cashDifference)];
  })].map((row) => row.map(cell).join(";")).join("\r\n");
}

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
  vat?: VatRow[]; vatMissing?: number; cashIn?: number; cashOut?: number; discountTotal?: number; cancelledAmount?: number;
  events?: { kind: "in" | "out" | "void"; amount: number; reason: string; at: string; createdBy: string; orderId: string | null }[];
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
