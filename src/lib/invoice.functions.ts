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
