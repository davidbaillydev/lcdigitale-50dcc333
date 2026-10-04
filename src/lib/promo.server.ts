import { computeDiscount, discountLabel, normalizeCode, type DiscountKind, type Marketing } from "./promo";

export type DiscountResult = { discount: number; code: string | null; label: string; error?: string };

/** Calcule la remise côté serveur : code promo prioritaire, sinon offre de premier achat (site uniquement). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveDiscount(db: any, r: { id: string; config: { marketing?: Marketing } }, subtotal: number,
  opts: { code?: string | null; email?: string | null; phone?: string | null; channel: "web" | "kiosk" }): Promise<DiscountResult> {
  const code = opts.code ? normalizeCode(opts.code) : "";
  if (code) {
    const { data: p } = await db.from("restaurant_promo_codes").select("*").eq("restaurant_id", r.id).eq("code", code).maybeSingle();
    const now = Date.now();
    if (!p || !p.active) return { discount: 0, code: null, label: "", error: "Code promo invalide." };
    if ((p.starts_at && new Date(p.starts_at).getTime() > now) || (p.ends_at && new Date(p.ends_at).getTime() < now))
      return { discount: 0, code: null, label: "", error: "Ce code promo n'est plus valable." };
    if (subtotal < Number(p.min_order)) return { discount: 0, code: null, label: "", error: `Code valable dès ${Number(p.min_order).toFixed(2).replace(".", ",")} € de commande.` };
    return { discount: computeDiscount(p.kind as DiscountKind, Number(p.value), subtotal), code, label: `Code ${code} (${discountLabel(p.kind, Number(p.value))})` };
  }
  const f = r.config.marketing?.firstOrder;
  if (opts.channel !== "web" || !f?.enabled || subtotal < (f.minOrder ?? 0)) return { discount: 0, code: null, label: "" };
  const email = opts.email?.trim().toLowerCase();
  const phone = opts.phone?.replace(/\D/g, "");
  if (!email && (!phone || phone.length < 8)) return { discount: 0, code: null, label: "" };
  const { data: past } = await db.from("orders").select("email, phone").eq("restaurant_id", r.id).not("status", "in", "(awaiting_payment,cancelled)").limit(5000);
  const seen = (past ?? []).some((o: { email: string | null; phone: string }) =>
    (email && o.email?.toLowerCase() === email) || (phone && phone.length >= 8 && o.phone.replace(/\D/g, "") === phone));
  if (seen) return { discount: 0, code: null, label: "" };
  return { discount: computeDiscount(f.kind, f.value, subtotal), code: "PREMIERE-COMMANDE", label: `Offre première commande (${discountLabel(f.kind, f.value)})` };
}
