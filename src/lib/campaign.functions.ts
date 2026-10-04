import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Envoie une campagne aux clients ciblés — le serveur ne garde que les clients consentants avec email. */
export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    if (!process.env["BREVO_API_KEY"]) throw new Error("Brevo n'est pas connecté.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { campaignHtml, unsubToken } = await import("./campaign.server");
    const { data: r } = await supabaseAdmin.from("restaurants").select("name, email, brand").eq("id", data.restaurantId).single();
    if (!r) throw new Error("Restaurant introuvable");
    const html = campaignHtml({ restaurant: r.name, body: data.body, ctaUrl: data.ctaUrl || undefined, ctaLabel: data.ctaLabel, color: (r.brand as { accent?: string })?.accent });
    const base = { sender: { ...SENDER, name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), subject: data.subject, htmlContent: html };

    if (data.testEmail) {
      await brevo({ ...base, subject: `[TEST] ${data.subject}`, to: [{ email: data.testEmail }], params: { name: "client", unsub: `${data.origin}/desabonnement` } });
      return { sent: 1, test: true };
    }

    const recipients: { id: string; email: string; name: string | null }[] = [];
    for (let i = 0; i < data.customerIds.length; i += 500) {
      const { data: rows } = await supabaseAdmin.from("restaurant_customers").select("id, email, name")
        .eq("restaurant_id", data.restaurantId).eq("marketing_consent", true).not("email", "is", null).in("id", data.customerIds.slice(i, i + 500));
      recipients.push(...((rows ?? []) as typeof recipients));
    }
    if (!recipients.length) throw new Error("Aucun client consentant avec email dans la sélection.");

    let sent = 0, error: string | null = null;
    try {
      for (let i = 0; i < recipients.length; i += 500) {
        await brevo({ ...base, messageVersions: recipients.slice(i, i + 500).map((c) => ({
          to: [{ email: c.email, ...(c.name ? { name: c.name } : {}) }],
          params: { name: c.name?.split(" ")[0] || "client", unsub: `${data.origin}/desabonnement?c=${c.id}&t=${unsubToken(c.id)}` },
        })) });
        sent += Math.min(500, recipients.length - i);
      }
    } catch (e) { error = (e as Error).message; }
    await supabaseAdmin.from("restaurant_campaigns").insert({ restaurant_id: data.restaurantId, subject: data.subject, recipients: sent, status: error ? (sent ? "partial" : "failed") : "sent", error, created_by: context.userId });
    if (error && !sent) throw new Error(error);
    return { sent, test: false, error };
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
