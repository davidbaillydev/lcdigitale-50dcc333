import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InvoiceData } from "./invoice";

/** Émet (ou retrouve) la facture d'une commande. Numéro continu par établissement, données figées. */
export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS : la lecture n'aboutit que si l'utilisateur a accès au restaurant
    const { data: o } = await context.supabase
      .from("orders")
      .select("id, order_number, restaurant_id, customer_name, email, address, postal_code, city, items, subtotal, delivery_fee, discount, promo_code, total, payment_method, payment_status, status, created_at, mode")
      .eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    if (["awaiting_payment", "cancelled", "pending_validation"].includes(o.status)) throw new Error("Facture possible uniquement pour une commande confirmée.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("restaurant_invoices").select("number, issued_at, data").eq("order_id", o.id).maybeSingle();
    if (existing) return existing as unknown as { number: string; issued_at: string; data: InvoiceData };
    const { data: r } = await supabaseAdmin.from("restaurants").select("name, address, city, phone, email, legal").eq("id", o.restaurant_id).single();
    if (!r) throw new Error("Restaurant introuvable");
    const legal = (r.legal ?? {}) as Record<string, string>;
    if (!legal["company"] || !legal["siret"]) throw new Error("Complétez la raison sociale et le SIRET dans « Légal & RGPD » (agence) avant d'émettre une facture.");
    const rate = Math.min(Math.max(Number(String(legal["vatRate"] ?? "10").replace(",", ".")) || 10, 0), 30);
    const items = o.items as { name: string; qty: number; unit: number; total: number; details?: string[] }[];
    const lines = [
      ...items.map((i) => ({ name: i.name + (i.details?.length ? ` (${i.details.join(", ")})` : ""), qty: i.qty, unitTTC: Number(i.unit), totalTTC: Number(i.total) })),
      ...(Number(o.delivery_fee) > 0 ? [{ name: "Frais de livraison", qty: 1, unitTTC: Number(o.delivery_fee), totalTTC: Number(o.delivery_fee) }] : []),
      ...(Number(o.discount) > 0 ? [{ name: `Remise${o.promo_code ? ` ${o.promo_code}` : ""}`, qty: 1, unitTTC: -Number(o.discount), totalTTC: -Number(o.discount) }] : []),
    ];
    const ttc = Number(o.total);
    const ht = Math.round((ttc / (1 + rate / 100)) * 100) / 100;
    const snapshot: InvoiceData = {
      seller: { company: legal["company"], form: legal["form"] ?? "", capital: legal["capital"] ?? "", siret: legal["siret"], rcs: legal["rcs"] ?? "", vat: legal["vat"] ?? "", tradeName: r.name, address: r.address ?? "", city: r.city ?? "", phone: r.phone ?? "", email: r.email ?? "" },
      buyer: { name: o.customer_name, email: o.email ?? "", address: [o.address, o.postal_code, o.city].filter(Boolean).join(" ") },
      orderNumber: o.order_number, orderDate: o.created_at, lines, vatRate: rate, totalHT: ht, totalVAT: Math.round((ttc - ht) * 100) / 100, totalTTC: ttc,
      paid: o.payment_status === "paid" || o.status === "done", paymentMethod: o.payment_method,
    };
    const { data: inv, error } = await supabaseAdmin.rpc("issue_invoice", { _order_id: o.id, _restaurant_id: o.restaurant_id, _data: snapshot as never });
    if (error || !inv) { console.error(error); throw new Error("Impossible d'émettre la facture."); }
    const row = inv as unknown as { number: string; issued_at: string; data: InvoiceData };
    return { number: row.number, issued_at: row.issued_at, data: row.data };
  });
