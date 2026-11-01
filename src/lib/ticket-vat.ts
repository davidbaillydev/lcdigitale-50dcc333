// Ventilation de la TVA d'un ticket, ligne par ligne selon le taux de chaque plat (suppléments inclus).
import type { LegalInfo } from "./legal";

export type VatRow = { rate: number; ht: number; vat: number; ttc: number };
export type VatItem = { id?: string; total?: number | string | null; vatRate?: number | null };
export type VatOrder = { items: VatItem[]; total: number | string; delivery_fee?: number | string | null; service_fee?: number | string | null; discount?: number | string | null };
export type VatContext = { defaultRate?: number | string | null; itemRates?: Record<string, number | undefined> };

const r2 = (n: number) => Math.round(n * 100) / 100;
const ALLOWED = [0, 2.1, 5.5, 10, 20];

/** Taux par défaut de l'établissement (mentions légales), 10 % si absent ou invalide. */
export function defaultVatRate(v?: number | string | null): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 30 ? n : 10;
}
/** Taux d'une ligne : figé sur la commande, sinon carte actuelle, sinon défaut. */
export function itemVatRate(it: VatItem, ctx: VatContext = {}): number {
  const r = it.vatRate ?? (it.id ? ctx.itemRates?.[it.id] : undefined);
  return r != null && ALLOWED.includes(Number(r)) ? Number(r) : defaultVatRate(ctx.defaultRate);
}

/**
 * Montants TTC par taux : articles à leur taux ; remise répartie au prorata des articles ;
 * frais de livraison et de service au taux par défaut. La somme égale toujours le total payé.
 */
export function vatBreakdown(o: VatOrder, ctx: VatContext = {}): VatRow[] {
  const def = defaultVatRate(ctx.defaultRate);
  const total = r2(Number(o.total) || 0);
  const fees = r2(Number(o.delivery_fee ?? 0) + Number(o.service_fee ?? 0));
  const goods = r2(total - fees);
  const by = new Map<number, number>();
  const lines = o.items.filter((i) => i.total != null && Number.isFinite(Number(i.total)));
  const sum = lines.reduce((s, i) => s + Number(i.total), 0);
  if (lines.length && sum > 0) {
    // Prorata : couvre la remise et tout écart d'arrondi par rapport aux articles saisis.
    const k = goods / sum;
    for (const i of lines) { const rate = itemVatRate(i, ctx); by.set(rate, (by.get(rate) ?? 0) + Number(i.total) * k); }
  } else if (goods !== 0) by.set(def, goods);
  if (fees) by.set(def, (by.get(def) ?? 0) + fees);
  const rows = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rate, ttc]) => ({ rate, ttc: r2(ttc) }));
  // Corrige le centime d'arrondi sur la plus grosse ligne pour que la somme égale le total.
  const diff = r2(total - rows.reduce((s, r) => s + r.ttc, 0));
  if (diff && rows.length) { const big = rows.reduce((a, b) => (Math.abs(b.ttc) > Math.abs(a.ttc) ? b : a)); big.ttc = r2(big.ttc + diff); }
  return rows.filter((r) => r.ttc !== 0).map(({ rate, ttc }) => { const ht = r2(ttc / (1 + rate / 100)); return { rate, ht, vat: r2(ttc - ht), ttc }; });
}

export const vatRateLabel = (rate: number) => `${String(rate).replace(".", ",")} %`;

export type TicketLegal = { company?: string; tradeName?: string; siret?: string; vat?: string; vatExemption?: string };
/** Mentions légales à imprimer ; rien si aucune donnée renseignée. */
export function ticketLegalLines(legal?: TicketLegal | LegalInfo | null, tradeName?: string): string[] {
  if (!legal) return [];
  const l = legal as TicketLegal & LegalInfo;
  const out: string[] = [];
  if (l.company?.trim()) out.push(l.company.trim() + (tradeName && tradeName.trim().toLowerCase() !== l.company.trim().toLowerCase() ? ` — Enseigne ${tradeName}` : ""));
  if (l.siret?.trim()) out.push(`SIRET : ${l.siret.trim()}`);
  if (l.vatExemption?.trim()) out.push(l.vatExemption.trim());
  else if (l.vat?.trim()) out.push(`TVA intracom. : ${l.vat.trim()}`);
  return out;
}
