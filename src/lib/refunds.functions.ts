// Remboursement unifié (Stripe + Mollie) avec émission automatique d'un avoir Factur-X numéroté AV-AAAA-NNNNN.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Invoice, InvoiceData } from "./invoice";

export const REFUND_REASONS = {
  out_of_stock: "Rupture d'ingrédient",
  kitchen_delay: "Retard excessif",
  customer_request: "Demande du client",
  input_error: "Erreur de saisie",
  other: "Autre",
} as const;
export type RefundReason = keyof typeof REFUND_REASONS;

const r2 = (n: number) => Math.round(n * 100) / 100;
const providerOf = (ref: string | null) => (!ref ? null : ref.startsWith("pi_") ? "stripe" as const : ref.startsWith("mollie:") ? "mollie" as const : null);

/** Gérant ou agence : rembourse tout ou partie d'une commande payée en ligne et émet l'avoir. */
export const refundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    amount: z.number().positive().max(100000).optional(),
    itemIndexes: z.array(z.number().int().min(0).max(200)).max(200).optional(),
    reason: z.enum(Object.keys(REFUND_REASONS) as [RefundReason, ...RefundReason[]]),
    requestKey: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: o } = await db.from("orders").select("id, is_test, order_number, restaurant_id, total, refunded_amount, payment_method, payment_status, payment_ref, email, customer_name").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: o.restaurant_id });
    if (!ok) throw new Error("Réservé au gérant de l'établissement ou à l'agence.");
    const { performRefund } = await import("./refunds.server");
    return performRefund(db, o, { amount: data.amount, itemIndexes: data.itemIndexes, reason: data.reason, reasonLabel: REFUND_REASONS[data.reason], key: `refund_${o.id}_${data.requestKey}`, userId: context.userId });
  });

/** Personnel : avoirs d'une commande accessibles via RLS (cloisonnés par établissement). */
export const listCreditNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("order_refunds").select("credit_note_number, created_at, data").eq("order_id", data.orderId).order("created_at");
    return (rows ?? []).map((r) => ({ number: r.credit_note_number, issued_at: r.created_at, data: r.data as unknown as InvoiceData })) as Invoice[];
  });

/** Client : avoirs de sa commande (autorisation client signée obligatoire). */
export const getCustomerCreditNotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), access: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("./customer-access.server");
    requireCustomerAccess("order", data.orderId, data.access);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("order_refunds").select("credit_note_number, created_at, data").eq("order_id", data.orderId).order("created_at");
    return (rows ?? []).map((r) => ({ number: r.credit_note_number, issued_at: r.created_at, data: r.data as unknown as InvoiceData })) as Invoice[];
  });
