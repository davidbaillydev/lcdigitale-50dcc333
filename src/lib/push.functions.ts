import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { customerOrderStage } from "@/lib/kitchen-status";

const endpoint = z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Adresse invalide");

const STATUS_MSG: Record<string, (n: number, mode: string) => string> = {
  accepted: (n) => `Commande n° ${n} confirmée, elle part en préparation.`,
  preparing: (n) => `Commande n° ${n} en préparation.`,
  ready: (n, mode) => mode === "delivery" ? `Commande n° ${n} prête, en attente du départ en livraison.` : `Commande n° ${n} prête ! Vous pouvez venir la récupérer.`,
  en_route: (n) => `Commande n° ${n} : votre livreur est en route !`,
  delivering: (n) => `Commande n° ${n} en cours de livraison.`,
  done: (n, mode) => mode === "delivery" ? `Commande n° ${n} livrée. Bon appétit !` : `Commande n° ${n} remise. Bon appétit !`,
  cancelled: (n) => `Commande n° ${n} annulée. Contactez le restaurant pour plus d'informations.`,
};

/** Client : abonne cet appareil au suivi de sa commande (l'UUID de commande sert de clé d'accès). */
export const subscribeOrderPush = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), endpoint }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders").select("id, restaurant_id").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({ endpoint: data.endpoint, order_id: o.id, restaurant_id: o.restaurant_id, audience: "customer", last_title: null, last_body: null, last_url: null }, { onConflict: "endpoint" });
    if (error) { console.error(error); throw new Error("Abonnement impossible"); }
    return { ok: true };
  });

/** Personnel : envoie la notification correspondant au statut actuel de la commande. */
export const notifyOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), origin: z.string().url().max(200).regex(/^https?:\/\/[^/]+$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id, is_test, order_number, status, courier_status, mode, restaurants(slug, name)").eq("id", data.orderId).maybeSingle();
    if (!o || o.is_test) return { sent: 0 };
    const text = STATUS_MSG[customerOrderStage(o)];
    if (!text) return { sent: 0 };
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendOrderConfirmation } = await import("./order-email.server");
      await sendOrderConfirmation(supabaseAdmin, o.id, data.origin).catch((e) => console.error(e));
    }
    const r = o.restaurants as unknown as { slug: string; name: string } | null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifySubscribers } = await import("./push.server");
    const sent = await notifySubscribers(supabaseAdmin, { order_id: o.id, audience: "customer" }, { title: r?.name ?? "Votre commande", body: text(o.order_number, o.mode), url: `/${r?.slug ?? ""}/suivi/${o.id}` });
    return { sent };
  });
