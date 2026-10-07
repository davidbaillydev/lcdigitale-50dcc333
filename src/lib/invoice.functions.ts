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

/** Client : l'identifiant (UUID non devinable) de sa commande, déjà utilisé pour le suivi, sert de clé d'accès. */
export const getCustomerInvoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
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
    const { data: inv } = await context.supabase.from("restaurant_invoices").select("id").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("restaurant_invoices").update({ buyer_b2b: data.buyer, buyer_b2b_updated_at: at, buyer_b2b_by: context.userId }).eq("id", inv.id);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true, at };
  });
