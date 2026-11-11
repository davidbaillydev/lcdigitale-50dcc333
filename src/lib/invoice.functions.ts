import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Personnel : émet (ou retrouve) la facture d'une commande accessible via RLS. */
export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueForOrder } = await import("./invoice.server");
    return issueForOrder(supabaseAdmin, o.id);
  });

/** Client : accès par autorisation signée créée à la commande. */
export const getCustomerInvoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("./customer-access.server");
    requireCustomerAccess("order", data.orderId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueForOrder } = await import("./invoice.server");
    return issueForOrder(supabaseAdmin, data.orderId);
  });

const b2bSchema = z.object({
  invoiceId: z.string().uuid(),
  buyer: z.object({
    company: z.string().trim().min(2).max(120),
    siren: z.string().trim().regex(/^\d{9}$/, "SIREN : 9 chiffres"),
    vatNumber: z.string().trim().regex(/^[A-Z]{2}[0-9A-Z]{2,13}$/, "N° TVA invalide").optional().or(z.literal("")),
    address: z.string().trim().min(3).max(200),
    postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal : 5 chiffres"),
    city: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
  }),
});

/** Personnel : complète l'identité B2B du client après émission (données figées intactes, complément daté et attribué). */
export const updateInvoiceBuyer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => b2bSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from("restaurant_invoices").select("id, restaurant_id").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    // La lecture RLS ne prouve pas le droit d'écrire : seul un gérant (ou l'agence) complète l'identité B2B.
    const { data: canWrite } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: inv.restaurant_id });
    if (!canWrite) throw new Error("Réservé au gérant ou à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("restaurant_invoices").update({ buyer_b2b: data.buyer, buyer_b2b_updated_at: at, buyer_b2b_by: context.userId }).eq("id", inv.id);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true, at };
  });
