import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { eligibleSms, smsContent, smsDraftSchema, smsMetrics, smsPhone, type SmsCustomer } from "./sms-campaign";

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
async function provider(path: string, body?: unknown) {
  const key = process.env["BREVO_API_KEY"], auth = process.env["LOVABLE_API_KEY"];
  if (!key || !auth) throw new Error("Brevo n'est pas connecté.");
  return fetch(`${GATEWAY}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
}
async function failure(res: Response) {
  const body = await res.text();
  console.error(`Brevo SMS [${res.status}]: ${body}`);
  return `Brevo [${res.status}] : ${body}`;
}
type AuthContext = { userId: string; supabase: { rpc: (name: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown; error: unknown }> } };
async function agency(context: AuthContext) {
  const result = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (result.error || result.data !== true) throw new Error("Réservé à l'agence.");
}
export const smsCampaignData = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await agency(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const restaurants = await db.from("restaurants").select("id,name,config").order("name");
    if (restaurants.error) throw restaurants.error;
    const rows: SmsCustomer[] = [];
    if (data.restaurantId) for (let i = 0; ; i += 1000) {
      const result = await db.from("restaurant_customers").select("id,name,phone,marketing_consent,consent_at").eq("restaurant_id", data.restaurantId).order("id").range(i, i + 999);
      if (result.error) throw result.error;
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    const history = data.restaurantId ? await db.from("restaurant_sms_campaigns").select("*").eq("restaurant_id", data.restaurantId).order("created_at", { ascending: false }).limit(30) : { data: [], error: null };
    if (history.error) throw history.error;
    const restaurant = restaurants.data?.find((r) => r.id === data.restaurantId);
    const country = (restaurant?.config as { country?: string } | null)?.country ?? "FR";
    return { restaurants: restaurants.data ?? [], customers: eligibleSms(rows, country), campaigns: history.data ?? [] };
  });

export const createSmsCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => smsDraftSchema.parse(d))
  .handler(async ({ data, context }) => {
    await agency(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const content = smsContent(data.body);
    const result = await db.from("restaurant_sms_campaigns").upsert({ id: data.campaignId, restaurant_id: data.restaurantId, name: data.name, sender: data.sender, content, customer_ids: [...new Set(data.customerIds)], created_by: context.userId }, { onConflict: "id", ignoreDuplicates: true });
    if (result.error) throw result.error;
    const saved = await db.from("restaurant_sms_campaigns").select("id,restaurant_id,name,sender,content,customer_ids").eq("id", data.campaignId).single();
    if (saved.error || !saved.data || saved.data.restaurant_id !== data.restaurantId || saved.data.name !== data.name || saved.data.sender !== data.sender || saved.data.content !== content || JSON.stringify(saved.data.customer_ids) !== JSON.stringify([...new Set(data.customerIds)])) throw new Error("Cette campagne est figée : créez une nouvelle campagne pour changer son contenu ou ses destinataires.");
    return { id: saved.data.id };
  });

export const testSmsCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), sender: smsDraftSchema.shape.sender, body: smsDraftSchema.shape.body, phone: z.string().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    await agency(context);
    const phone = smsPhone(data.phone.startsWith("+") || data.phone.startsWith("00") ? data.phone : "", "FR");
    if (!phone) throw new Error("Indiquez un numéro de test international (+33…).");
    // Tests may only reach a known internal number: the restaurant's own phone or the agency user's account phone.
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [rest, user] = await Promise.all([db.from("restaurants").select("phone,config").eq("id", data.restaurantId).maybeSingle(), db.auth.admin.getUserById(context.userId)]);
    if (rest.error || !rest.data) throw new Error("Restaurant introuvable.");
    const country = (rest.data.config as { country?: string } | null)?.country ?? "FR";
    const allowed = [rest.data.phone, user.data?.user?.phone ? `+${user.data.user.phone.replace(/^\+/, "")}` : null].filter((v): v is string => !!v).map((v) => smsPhone(v, country)).filter(Boolean);
    if (!allowed.includes(phone)) throw new Error("Le SMS test ne peut être envoyé qu'au téléphone du restaurant ou à celui de votre compte.");
    const content = smsContent(`[TEST] ${data.body}`);
    const response = await provider("/transactionalSMS/send", { recipient: phone, sender: data.sender, content, type: "marketing", unicodeEnabled: smsMetrics(content).unicode });
    if (!response.ok) throw new Error(await failure(response));
    const result = await response.json() as { messageId?: string | number };
    if (!result.messageId) throw new Error("Réponse Brevo incertaine : vérifiez avant de renvoyer le test.");
    return { messageId: String(result.messageId) };
  });

/** Five recipients per invocation; the browser drives a bounded, explicitly confirmed wave. */
export const sendSmsBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaignId: z.string().uuid(), limit: z.number().int().min(1).max(5).default(5) }).parse(d))
  .handler(async ({ data, context }) => {
    await agency(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const loaded = await db.from("restaurant_sms_campaigns").select("*").eq("id", data.campaignId).single();
    if (loaded.error || !loaded.data) throw new Error("Campagne introuvable.");
    const campaign = loaded.data;
    if (campaign.state === "done") return { processed: 0, done: true };
    const claim = await db.from("restaurant_sms_campaigns").update({ state: "sending", error: null }).eq("id", campaign.id).eq("state", "idle").eq("sent", campaign.sent).eq("skipped", campaign.skipped).select("id").maybeSingle();
    if (claim.error) throw claim.error;
    if (!claim.data) throw new Error("Envoi en cours ou incertain : vérifiez dans Brevo avant de poursuivre.");
    let uncertain = false;
    try {
      const r = await db.from("restaurants").select("config").eq("id", campaign.restaurant_id).single();
      if (r.error) throw r.error;
      const country = (r.data.config as { country?: string } | null)?.country ?? "FR";
      const ids = campaign.remaining_ids.slice(0, data.limit);
      let sent = 0, skipped = 0;
      // Sequential to stay below the Worker connection budget and retain precise failure state.
      for (const id of ids) {
        const fresh = await db.from("restaurant_customers").select("id,name,phone,marketing_consent,consent_at").eq("restaurant_id", campaign.restaurant_id).eq("id", id).maybeSingle();
        if (fresh.error) throw fresh.error;
        const customer = eligibleSms(fresh.data ? [fresh.data] : [], country, campaign.sent_phones)[0];
        if (!customer) { skipped++; continue; }
        const previous = await db.from("restaurant_sms_deliveries").select("state").eq("campaign_id", campaign.id).eq("phone", customer.phone).maybeSingle();
        if (previous.error) throw previous.error;
        if (previous.data) {
          if (["sending", "uncertain", "failed"].includes(previous.data.state)) { uncertain = true; throw new Error("Destinataire déjà tenté : vérification Brevo requise."); }
          skipped++; continue;
        }
        const contact = await provider(`/contacts/${encodeURIComponent(customer.phone)}?identifierType=phone_id`);
        if (contact.status !== 404 && !contact.ok) throw new Error(await failure(contact));
        if (contact.ok && ((await contact.json()) as { smsBlacklisted?: boolean }).smsBlacklisted) { skipped++; continue; }
        // Recheck after the external blacklist lookup, immediately before claiming a paid send.
        const consent = await db.from("restaurant_customers").select("id,name,phone,marketing_consent,consent_at").eq("restaurant_id", campaign.restaurant_id).eq("id", id).maybeSingle();
        if (consent.error) throw consent.error;
        if (eligibleSms(consent.data ? [consent.data] : [], country)[0]?.phone !== customer.phone) { skipped++; continue; }
        const delivery = await db.from("restaurant_sms_deliveries").insert({ campaign_id: campaign.id, customer_id: customer.id, phone: customer.phone }).select("id").single();
        if (delivery.error) throw delivery.error;
        uncertain = true;
        const res = await provider("/transactionalSMS/send", { recipient: customer.phone, sender: campaign.sender, content: campaign.content, type: "marketing", unicodeEnabled: smsMetrics(campaign.content).unicode, tag: campaign.id });
        if (!res.ok) {
          const error = await failure(res);
          await db.from("restaurant_sms_deliveries").update({ state: "failed", error }).eq("id", delivery.data.id);
          throw new Error(error);
        }
        const result = await res.json() as { messageId?: string | number };
        if (!result.messageId) throw new Error("Réponse Brevo sans référence d'envoi.");
        const saved = await db.from("restaurant_sms_deliveries").update({ state: "submitted", message_id: String(result.messageId) }).eq("id", delivery.data.id);
        if (saved.error) throw saved.error;
        sent++;
        uncertain = false;
      }
      const remaining = campaign.remaining_ids.slice(ids.length);
      const phones: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const deliveries = await db.from("restaurant_sms_deliveries").select("phone").eq("campaign_id", campaign.id).eq("state", "submitted").order("id").range(offset, offset + 999);
        if (deliveries.error) throw deliveries.error;
        phones.push(...(deliveries.data ?? []).map((d) => d.phone));
        if ((deliveries.data?.length ?? 0) < 1000) break;
      }
      const saved = await db.from("restaurant_sms_campaigns").update({ remaining_ids: remaining, sent: phones.length, sent_phones: phones, skipped: campaign.skipped + skipped, state: remaining.length ? "idle" : "done" }).eq("id", campaign.id);
      if (saved.error) { uncertain = true; throw saved.error; }
      return { processed: ids.length, sent, skipped, done: !remaining.length };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Échec d'envoi";
      await db.from("restaurant_sms_campaigns").update({ state: uncertain ? "uncertain" : "idle", error }).eq("id", campaign.id);
      throw new Error(uncertain ? `${error} — Reprise bloquée pour éviter les doublons ; vérifiez Brevo.` : error);
    }
  });