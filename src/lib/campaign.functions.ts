import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { greetingText } from "@/lib/email-templates";
import { selectWave, waveSizeSchema } from "@/lib/campaign-waves";

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const SENDER = { email: "contact@lcdigitale.fr" };

const schema = z.object({
  restaurantId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1).max(5000),
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(5).max(5000),
  ctaUrl: z.string().url().max(300).optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(40).optional(),
  origin: z.string().url().max(200).regex(/^https?:\/\/[^/]+$/),
  testEmail: z.string().email().max(255).optional(),
  waveSize: waveSizeSchema,
  campaignId: z.string().uuid(),
});

async function brevo(body: unknown) {
  const res = await fetch(`${GATEWAY}/smtp/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": process.env["BREVO_API_KEY"]! },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Brevo [${res.status}]: ${t}`);
    throw new Error(`Brevo a refusé l'envoi (${res.status}) : ${t.slice(0, 200)}`);
  }
}

/** Prénom d'un client réellement ciblé : l'email de test montre alors le rendu final. */
async function firstNameOfTarget(restaurantId: string, customerIds: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < customerIds.length; i += 500) {
    const { data: rows } = await supabaseAdmin.from("restaurant_customers")
      .select("name").eq("restaurant_id", restaurantId).eq("marketing_consent", true)
      .not("email", "is", null).not("name", "is", null).in("id", customerIds.slice(i, i + 500)).limit(1);
    const name = (rows?.[0] as { name?: string | null } | undefined)?.name?.trim();
    if (name) return name;
  }
  return null;
}

/** Envoie une campagne aux clients ciblés — le serveur ne garde que les clients consentants avec email. */
export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Réservé à l'agence");
    if (!process.env["BREVO_API_KEY"]) throw new Error("Brevo n'est pas connecté.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { campaignHtml, unsubToken } = await import("./campaign.server");
    const { data: r } = await supabaseAdmin.from("restaurants").select("name, email, brand, logo_url, address, city, phone").eq("id", data.restaurantId).single();
    if (!r) throw new Error("Restaurant introuvable");
    const html = campaignHtml({ restaurant: r.name, body: data.body, ctaUrl: data.ctaUrl || undefined, ctaLabel: data.ctaLabel, color: (r.brand as { accent?: string })?.accent, subject: data.subject, brand: { logoUrl: r.logo_url, address: r.address, city: r.city, phone: r.phone } });
    const base = { sender: { ...SENDER, name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), subject: data.subject, htmlContent: html };

    if (data.testEmail) {
      const sample = (await firstNameOfTarget(data.restaurantId, data.customerIds)) ?? "Alexia";
      await brevo({ ...base, subject: `[TEST] ${data.subject}`, to: [{ email: data.testEmail }], params: { greeting: greetingText(sample), unsub: `${data.origin}/desabonnement` } });
      return { sent: 1, test: true };
    }

    const payload = { subject: data.subject, body: data.body, ctaUrl: data.ctaUrl || "", ctaLabel: data.ctaLabel ?? "", origin: data.origin };
    const { error: initError } = await supabaseAdmin.from("restaurant_campaign_waves").upsert({
      id: data.campaignId, restaurant_id: data.restaurantId, payload,
      remaining_ids: [...new Set(data.customerIds)], created_by: context.userId,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (initError) throw initError;
    const { data: campaign, error: loadError } = await supabaseAdmin.from("restaurant_campaign_waves")
      .select("*").eq("id", data.campaignId).eq("restaurant_id", data.restaurantId).single();
    if (loadError || !campaign) throw new Error("Campagne introuvable.");
    if (JSON.stringify(campaign.payload) !== JSON.stringify(JSON.parse(JSON.stringify(payload)))) {
      // jsonb key order is not stable: compare fields rather than serialized ordering.
      const saved = campaign.payload as Record<string, unknown>;
      if (Object.entries(payload).some(([key, value]) => saved[key] !== value)) throw new Error("Le contenu de cette campagne ne peut plus être modifié.");
    }
    if (campaign.state === "done") return { sent: 0, test: false, error: null, totalSent: campaign.sent, remaining: 0 };
    const { data: claimed, error: claimError } = await supabaseAdmin.from("restaurant_campaign_waves")
      .update({ state: "sending", error: null }).eq("id", campaign.id).eq("state", "idle").select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) throw new Error("Envoi déjà en cours ou à vérifier dans Brevo avant de poursuivre.");

    let submitted = false;
    try {
      const rows: { id: string; email: string; name: string | null }[] = [];
      for (let i = 0; i < campaign.remaining_ids.length; i += 500) {
        const result = await supabaseAdmin.from("restaurant_customers").select("id, email, name")
          .eq("restaurant_id", data.restaurantId).eq("marketing_consent", true).not("email", "is", null)
          .in("id", campaign.remaining_ids.slice(i, i + 500));
        if (result.error) throw result.error;
        rows.push(...((result.data ?? []) as typeof rows));
      }
      const { recipients, remainingIds } = selectWave(campaign.remaining_ids, rows, data.waveSize, campaign.sent_emails);
      if (recipients.length) {
        submitted = true;
        await brevo({ ...base, messageVersions: recipients.map((c) => ({
          to: [{ email: c.email, ...(c.name ? { name: c.name } : {}) }],
          params: { greeting: greetingText(c.name), unsub: `${data.origin}/desabonnement?c=${c.id}&t=${unsubToken(c.id)}` },
        })) });
      }
      const totalSent = campaign.sent + recipients.length;
      const { error: saveError } = await supabaseAdmin.from("restaurant_campaign_waves").update({
        remaining_ids: remainingIds, sent_emails: [...campaign.sent_emails, ...recipients.map((c) => c.email)],
        sent: totalSent, state: remainingIds.length ? "idle" : "done",
      }).eq("id", campaign.id);
      if (saveError) throw saveError;
      if (recipients.length) await supabaseAdmin.from("restaurant_campaigns").insert({ restaurant_id: data.restaurantId, subject: data.subject, recipients: recipients.length, status: "sent", created_by: context.userId });
      return { sent: recipients.length, test: false, error: null, totalSent, remaining: remainingIds.length };
    } catch (e) {
      const error = (e as Error).message;
      await supabaseAdmin.from("restaurant_campaign_waves").update({ state: submitted ? "uncertain" : "idle", error }).eq("id", campaign.id);
      throw new Error(submitted ? `${error} — Vérifiez cette vague dans Brevo avant tout nouvel envoi.` : error);
    }
  });

/** Désabonnement public via lien signé */
export const unsubscribe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ c: z.string().uuid(), t: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { checkUnsubToken } = await import("./campaign.server");
    if (!checkUnsubToken(data.c, data.t)) throw new Error("Lien de désabonnement invalide.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_customers")
      .update({ marketing_consent: false, consent_at: new Date().toISOString(), consent_source: "désabonnement email" })
      .eq("id", data.c).select("restaurants(name)").maybeSingle();
    return { restaurant: (row as { restaurants?: { name: string } } | null)?.restaurants?.name ?? null };
  });
