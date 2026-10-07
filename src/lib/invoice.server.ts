import type { InvoiceData } from "./invoice";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const PAY: Record<string, string> = { online: "Carte bancaire en ligne (Stripe/PayPal/Lyra)", on_site: "Sur place (CB ou espèces)", counter: "Comptoir (CB ou espèces)", card_terminal: "Carte bancaire (TPE)" };

/** Émet ou retrouve la facture d'une commande (service role, appelant déjà vérifié). */
export async function issueForOrder(admin: Admin, orderId: string) {
  const { data: existing } = await admin.from("restaurant_invoices").select("number, issued_at, data").eq("order_id", orderId).maybeSingle();
  if (existing) return existing as unknown as { number: string; issued_at: string; data: InvoiceData };
  const { data: o } = await admin.from("orders").select("id, order_number, restaurant_id, customer_name, email, address, postal_code, city, table_label, room_label, items, delivery_fee, discount, promo_code, total, payment_method, payment_status, payment_ref, status, created_at, slot").eq("id", orderId).maybeSingle();
  if (!o) throw new Error("Commande introuvable");
  if (["awaiting_payment", "cancelled", "pending_approval", "new"].includes(o.status)) throw new Error("Facture disponible une fois la commande confirmée.");
  const { data: r } = await admin.from("restaurants").select("name, address, city, phone, email, legal, logo_url").eq("id", o.restaurant_id).single();
  if (!r) throw new Error("Restaurant introuvable");
  const legal = (r.legal ?? {}) as Record<string, string>;
  if (!legal["company"] || !legal["siret"]) throw new Error("Facturation indisponible : informations légales de l'établissement incomplètes.");
  const def = Math.min(Math.max(Number(String(legal["vatRate"] ?? "10").replace(",", ".")) || 10, 0), 30);
  const items = o.items as { name: string; qty: number; unit: number; total: number; details?: string[]; vatRate?: number }[];
  const lines = [
    ...items.map((i) => ({ name: i.name + (i.details?.length ? ` (${i.details.join(", ")})` : ""), qty: i.qty, unitTTC: Number(i.unit), totalTTC: Number(i.total), vatRate: i.vatRate ?? def })),
    ...(Number(o.delivery_fee) > 0 ? [{ name: "Frais de livraison", qty: 1, unitTTC: Number(o.delivery_fee), totalTTC: Number(o.delivery_fee), vatRate: def }] : []),
    ...(Number(o.discount) > 0 ? [{ name: `Remise${o.promo_code ? ` ${o.promo_code}` : ""}`, qty: 1, unitTTC: -Number(o.discount), totalTTC: -Number(o.discount), vatRate: def }] : []),
  ];
  const by = new Map<number, number>();
  for (const l of lines) by.set(l.vatRate, (by.get(l.vatRate) ?? 0) + l.totalTTC);
  const vatBreakdown = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rate, ttc]) => { const ht = r2(ttc / (1 + rate / 100)); return { rate, ht, vat: r2(ttc - ht), ttc: r2(ttc) }; });
  const ht = r2(vatBreakdown.reduce((s, v) => s + v.ht, 0));
  const ttc = Number(o.total);
  const where = o.table_label ? `Table ${o.table_label}` : o.room_label ? `Chambre ${o.room_label}` : [o.address, o.postal_code, o.city].filter(Boolean).join(" ");
  const snapshot: InvoiceData = {
    seller: { company: legal["company"], form: legal["form"] ?? "", capital: legal["capital"] ?? "", siret: legal["siret"], rcs: legal["rcs"] ?? "", vat: legal["vat"] ?? "", seat: legal["seat"] ?? "", tradeName: r.name, address: r.address ?? "", city: r.city ?? "", phone: r.phone ?? "", email: r.email ?? "", logo: r.logo_url ?? "" },
    buyer: { name: o.customer_name, email: o.email ?? "", address: where },
    orderNumber: o.order_number, orderId: o.id, orderDate: o.created_at, serviceDate: o.slot,
    lines, vatRate: def, vatBreakdown, totalHT: ht, totalVAT: r2(ttc - ht), totalTTC: ttc,
    paid: o.payment_status === "paid" || o.status === "done" || o.status === "ready", paymentMethod: o.payment_method, paymentLabel: PAY[o.payment_method] ?? o.payment_method,
  };
  const { data: inv, error } = await admin.rpc("issue_invoice", { _order_id: o.id, _restaurant_id: o.restaurant_id, _data: snapshot as never });
  if (error || !inv) { console.error(error); throw new Error("Impossible d'émettre la facture."); }
  const row = inv as unknown as { number: string; issued_at: string; data: InvoiceData };
  return { number: row.number, issued_at: row.issued_at, data: row.data };
}
