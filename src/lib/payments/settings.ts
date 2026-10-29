// Réglages des prestataires (clés masquées, enregistrement réservé à l'agence).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVIDERS, PUBLIC_FIELDS, admin, assertManager, getRow, mask, type Provider, type Row } from "./shared";

/** État des prestataires d'un restaurant (clés masquées). */
export const listPaymentProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const db = await admin();
    const { data: rows } = await db.from("restaurant_payment_providers").select("*").eq("restaurant_id", data.restaurantId);
    return PROVIDERS.map((p) => {
      const r = (rows as Row[] | null)?.find((x) => x.provider === p);
      return {
        provider: p,
        enabled: r?.enabled ?? false,
        credentials: Object.fromEntries(Object.entries(r?.credentials ?? {}).map(([k, v]) => [k, PUBLIC_FIELDS.includes(k) ? v : mask(v)])),
        settings: r?.settings ?? {},
      };
    });
  });

export const credSchema = z.record(z.string().max(40), z.string().trim().max(300));

/** Active/désactive un prestataire et met à jour ses clés (champ vide = clé conservée). */
export const savePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(), provider: z.enum(PROVIDERS), enabled: z.boolean(), credentials: credSchema,
    clear: z.array(z.string().max(40)).max(10).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const prev = await getRow(data.restaurantId, data.provider);
    const credentials = { ...(prev?.credentials ?? {}) };
    // Effacement explicite de clés saisies à la main (jamais les jetons OAuth ni le mode).
    for (const k of data.clear ?? []) if (!k.startsWith("oauth") && k !== "mode") delete credentials[k];
    for (const [k, v] of Object.entries(data.credentials)) if (v) credentials[k] = v;
    if (data.enabled && data.provider === "sumup" && (!credentials["apiKey"] || !credentials["merchantCode"]))
      throw new Error("Renseignez la clé API et le code marchand SumUp.");
    if (data.provider === "stripe") {
      const pk = credentials["publishableKey"] ?? "", sk = credentials["secretKey"] ?? "";
      if (data.enabled && (!pk || !sk)) throw new Error("Renseignez la clé publiable et la clé secrète Stripe.");
      if (pk && !/^pk_(test|live)_/.test(pk)) throw new Error("La clé publiable doit commencer par pk_test_ ou pk_live_.");
      if (sk && !/^(sk|rk)_(test|live)_/.test(sk)) throw new Error("La clé secrète doit commencer par sk_test_ ou sk_live_.");
      const mode = data.credentials["mode"] || credentials["mode"] || "test";
      credentials["mode"] = mode;
      if (pk && sk && (!pk.includes(`_${mode}_`) || !sk.includes(`_${mode}_`))) throw new Error(`Les clés ne correspondent pas au mode ${mode === "live" ? "réel" : "test"}.`);
    }
    if (data.provider === "stripe" && credentials["readerId"] && !/^tmr_[A-Za-z0-9]+$/.test(credentials["readerId"])) throw new Error("L'identifiant du lecteur Stripe commence par tmr_.");
    if (data.provider === "mollie" && credentials["terminalId"] && !/^term_[A-Za-z0-9]+$/.test(credentials["terminalId"])) throw new Error("L'identifiant du terminal Mollie commence par term_.");
    if (data.provider === "paypal") {
      credentials["mode"] = credentials["mode"] === "live" ? "live" : "sandbox";
      if (data.enabled && (!credentials["clientId"] || !credentials["secret"])) throw new Error("Renseignez le Client ID et le Secret PayPal.");
    }
    if (data.provider === "lyra") {
      credentials["mode"] = credentials["mode"] === "PRODUCTION" ? "PRODUCTION" : "TEST";
      if (credentials["siteId"] && !/^\d{8}$/.test(credentials["siteId"])) throw new Error("L'identifiant boutique doit contenir 8 chiffres.");
      if (credentials["gateway"] && !/^https:\/\/[a-z0-9.-]+\/vads-payment\/?$/i.test(credentials["gateway"])) throw new Error("Adresse de plateforme invalide (ex. https://secure.payzen.eu/vads-payment/).");
      if (data.enabled && (!credentials["siteId"] || !credentials["key"])) throw new Error("Renseignez l'identifiant boutique et la clé Lyra.");
    }
    if (data.provider === "mollie") {
      credentials["mode"] = credentials["mode"] === "live" ? "live" : "test";
      if (credentials["apiKeyTest"] && !/^test_[A-Za-z0-9]{20,}$/.test(credentials["apiKeyTest"])) throw new Error("La clé de test Mollie doit commencer par test_.");
      if (credentials["apiKeyLive"] && !/^live_[A-Za-z0-9]{20,}$/.test(credentials["apiKeyLive"])) throw new Error("La clé de production Mollie doit commencer par live_.");
      if (credentials["profileId"] && !/^pfl_[A-Za-z0-9]+$/.test(credentials["profileId"])) throw new Error("L'identifiant de profil Mollie commence par pfl_.");
      if (data.enabled && !credentials["oauthRefreshToken"] && !credentials[credentials["mode"] === "live" ? "apiKeyLive" : "apiKeyTest"]) throw new Error(`Renseignez la clé Mollie ${credentials["mode"] === "live" ? "de production" : "de test"}.`);
    }
    const db = await admin();
    const { error } = await db.from("restaurant_payment_providers").upsert({
      restaurant_id: data.restaurantId, provider: data.provider, enabled: data.enabled, credentials, settings: prev?.settings ?? {},
    });
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

/** Vérifie les clés SumUp et liste les terminaux associés au compte. */
