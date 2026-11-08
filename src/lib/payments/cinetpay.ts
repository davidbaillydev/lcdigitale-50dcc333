import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManager, getRow } from "./shared";
import { cinetpayCheckAccepted, cinetpayCredentialsSchema } from "./cinetpay-config";

export const testCinetpay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), transactionId: z.string().trim().max(100).regex(/^[A-Za-z0-9_-]*$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const row = await getRow(data.restaurantId, "cinetpay");
    const parsed = cinetpayCredentialsSchema.safeParse(row?.credentials);
    if (!parsed.success) throw new Error("Enregistrez le Site ID, les deux clés et le mode CinetPay avant le test.");
    if (parsed.data.mode === "sandbox") return { ok: false, msg: "Configuration de test enregistrée. Aucun environnement Sandbox Checkout n’est documenté : aucun appel de production effectué." };
    if (!data.transactionId) return { ok: false, msg: "Enregistrez puis renseignez l’identifiant d’une transaction CinetPay existante. L’API ne propose pas de validation des clés seules ; aucun paiement ne sera créé." };
    try {
      const response = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: parsed.data.apiKey, site_id: parsed.data.siteId, transaction_id: data.transactionId }),
        signal: AbortSignal.timeout(15000),
      });
      const body: unknown = await response.json();
      if (!response.ok || !cinetpayCheckAccepted(body)) return { ok: false, msg: "CinetPay n’a pas confirmé cette transaction. Vérifiez son identifiant et les clés du site ; leur validité ne peut pas être confirmée par cette réponse." };
      return { ok: true, msg: "Connexion confirmée pour cette transaction : Site ID et clé API acceptés. La clé secrète sera vérifiée avec une notification signée ; elle n’est pas validée par cet appel. Aucun paiement créé." };
    } catch {
      return { ok: false, msg: "CinetPay ne répond pas correctement. Réessayez plus tard ; aucun paiement créé et aucune clé validée." };
    }
  });