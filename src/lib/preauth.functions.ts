import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function staffOf(context: { supabase: any; userId: string }, orderId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: o } = await context.supabase.from("orders").select("restaurant_id").eq("id", orderId).maybeSingle();
  if (!o) throw new Error("Commande introuvable");
  const { data: ok } = await context.supabase.rpc("can_access_restaurant", { _user_id: context.userId, _restaurant_id: o.restaurant_id });
  if (!ok) throw new Error("Accès refusé");
}

/** Cuisine : « Accepter » une commande pré-autorisée = capture du paiement puis acceptation. */
export const acceptPreauthOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), slot: z.string().datetime().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await staffOf(context, data.orderId);
    const { captureOrder } = await import("./payments/preauth");
    await captureOrder(data.orderId, data.slot);
    return { ok: true };
  });

/** Cuisine : refus/annulation d'une commande pré-autorisée = empreinte relâchée, aucun débit. */
export const releasePreauthOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await staffOf(context, data.orderId);
    const { releaseOrder } = await import("./payments/preauth");
    return { released: await releaseOrder(data.orderId) };
  });
