import { issueAccessToken } from "./customer-access.server";
import { trustedOrigin } from "./trusted-origin";
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

import { orderReceivedHtml, restaurantNewOrderHtml, orderConfirmedHtml, refundHtml } from "@/lib/email-templates";
import { notificationRecipients, directRecipientSchema, type DirectRecipient } from "./order-notification-roles";
import { currencySchema } from "./money";

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const FALLBACK_ORIGIN = "https://restaurant.lcdigitale.fr";
const CONFIRMED = ["accepted", "preparing", "ready", "delivering", "done"];
const baseOf = (origin?: string | null) => { try { return trustedOrigin(origin); } catch { return FALLBACK_ORIGIN; } };

export type NotificationSettings = { received: boolean; confirmed: boolean; restaurant: boolean; team: boolean; agency: boolean; email?: string | undefined; recipients?: DirectRecipient[] | undefined };
/** Interrupteurs de notification (absents = actifs). */
export function notificationsOf(config: unknown): NotificationSettings {
  const n = ((config as { notifications?: Partial<NotificationSettings> } | null)?.notifications) ?? {};
  return { received: n.received !== false, confirmed: n.confirmed !== false, restaurant: n.restaurant !== false, team: n.team !== false, agency: n.agency !== false, email: n.email || undefined,
    recipients: Array.isArray(n.recipients) ? n.recipients.flatMap((r) => { const parsed = directRecipientSchema.safeParse(r); return parsed.success ? [parsed.data] : []; }) : undefined };
}

type Rest = { slug: string; name: string; email: string | null; brand: { accent?: string } | null; config: unknown; logo_url?: string | null; address?: string | null; city?: string | null; phone?: string | null };
const ORDER_COLS = "id, currency, restaurant_id, is_test, order_number, status, mode, slot, asap, total, items, notes, email, phone, customer_name, first_name, last_name, address, postal_code, city, table_label, payment_method, payment_status, confirmation_email_at, received_email_at, restaurant_email_at, restaurants(slug, name, email, brand, config, logo_url, address, city, phone)";

async function load(admin: Admin, orderId: string) {
  const { data: o } = await admin.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle();
  if (!o || o.is_test) return null;
  return { o: { ...o, currency: currencySchema.parse(o.currency) }, r: o.restaurants as unknown as Rest };
}

/** Réservation atomique : la colonne n'est posée qu'une fois, même si deux appels arrivent ensemble. */
async function claim(admin: Admin, id: string, col: "confirmation_email_at" | "received_email_at" | "restaurant_email_at") {
  const { data } = await admin.from("orders").update({ [col]: new Date().toISOString() } as never).eq("id", id).is(col, null).select("id");
  return !!data?.length;
}
async function release(admin: Admin, id: string, col: "confirmation_email_at" | "received_email_at" | "restaurant_email_at") {
  await admin.from("orders").update({ [col]: null } as never).eq("id", id);
}

async function brevo(payload: Record<string, unknown>, tag: string) {
  const res = await fetch(`${GATEWAY}/smtp/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": process.env["BREVO_API_KEY"]! },
    body: JSON.stringify({ ...payload, headers: { "X-Mailin-Tag": tag } }),
  });
  if (!res.ok) console.error(`Brevo ${tag} [${res.status}]: ${await res.text()}`);
  return res.ok;
}
const brevoReady = () => !!process.env["BREVO_API_KEY"] && !!process.env["LOVABLE_API_KEY"];


/** « Commande reçue » (client) : création en paiement sur place ou paiement en ligne confirmé. */
export async function sendOrderReceived(admin: Admin, orderId: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false };
  const d = await load(admin, orderId); if (!d) return { sent: false };
  const { o, r } = d;
  if (!o.email || o.received_email_at || o.status === "awaiting_payment" || o.status === "cancelled") return { sent: false };
  if (!notificationsOf(r.config).received) return { sent: false, reason: "disabled" };
  if (!(await claim(admin, o.id, "received_email_at"))) return { sent: false };
  const html = orderReceivedHtml({ ...o, accessToken: issueAccessToken("order", o.id) }, r, baseOf(origin));
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — commande n° ${o.order_number} reçue`, htmlContent: html }, "order-received");
  if (!ok) await release(admin, o.id, "received_email_at");
  return { sent: ok };
}

/** « Nouvelle commande » (restaurant). */
export async function sendRestaurantNewOrder(admin: Admin, orderId: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false };
  const d = await load(admin, orderId); if (!d) return { sent: false };
  const { o, r } = d;
  if (o.restaurant_email_at || o.status === "awaiting_payment" || o.status === "cancelled") return { sent: false };
  const n = notificationsOf(r.config);
  if (!n.restaurant) return { sent: false, reason: "disabled" };
  const [{ data: members, error: memberError }, { data: agencies, error: agencyError }] = await Promise.all([
    n.team ? admin.from("restaurant_members").select("user_id, role, notification_roles, notification_modes").eq("restaurant_id", o.restaurant_id) : Promise.resolve({ data: [], error: null }),
    n.agency ? admin.from("user_roles").select("user_id").eq("role", "admin") : Promise.resolve({ data: [], error: null }),
  ]);
  if (memberError || agencyError) throw new Error(memberError?.message || agencyError?.message);
  const userIds = [...new Set([...(members ?? []).map((m) => m.user_id), ...(agencies ?? []).map((m) => m.user_id)])];
  const emails = new Map(await Promise.all(userIds.map(async (id) => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) throw new Error("Impossible de résoudre un destinataire de commande");
    return [id, data.user?.email] as const;
  })));
  const recipients = notificationRecipients({ enabled: n.restaurant, mode: o.mode, fallback: n.email || r.email, recipients: n.recipients, team: n.team, agency: n.agency,
    members: (members ?? []).map((m) => ({ email: emails.get(m.user_id), roles: [...m.notification_roles, ...(m.role === "manager" ? ["responsable"] : [])], modes: m.notification_modes })),
    agencyEmails: (agencies ?? []).map((m) => emails.get(m.user_id)),
  });
  if (!recipients.length) return { sent: false, reason: "no_email" };
  const name = [o.first_name, o.last_name].filter(Boolean).join(" ") || o.customer_name;
  const html = restaurantNewOrderHtml(o, r, baseOf(origin));
  const results = await Promise.all(recipients.map(async (email) => {
    // Un destinataire par requête : aucune adresse de l'équipe n'est exposée aux autres.
    const { error: insertError } = await admin.from("order_notification_deliveries").insert({ order_id: o.id, recipient_email: email });
    if (insertError) {
      if (insertError.code !== "23505") throw new Error(insertError.message);
      const { data: retry, error: retryError } = await admin.from("order_notification_deliveries").update({ state: "sending", updated_at: new Date().toISOString() }).eq("order_id", o.id).eq("recipient_email", email).eq("state", "failed").select("id");
      if (retryError) throw new Error(retryError.message);
      if (!retry?.length) {
        const { data: prior } = await admin.from("order_notification_deliveries").select("state").eq("order_id", o.id).eq("recipient_email", email).single();
        return prior?.state === "sent";
      }
    }
    let state: "sent" | "failed" | "uncertain" = "uncertain";
    try {
      const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: "LC Digitale" }, to: [{ email, name: r.name }], ...(o.email ? { replyTo: { email: o.email, name } } : {}), subject: `Nouvelle commande n° ${o.order_number} — ${name}`, htmlContent: html }, "order-restaurant");
      state = ok ? "sent" : "failed";
    } finally {
      const { error } = await admin.from("order_notification_deliveries").update({ state, updated_at: new Date().toISOString() }).eq("order_id", o.id).eq("recipient_email", email);
      if (error) throw new Error(error.message);
    }
    return state === "sent";
  }));
  const sent = results.every(Boolean);
  if (sent) await claim(admin, o.id, "restaurant_email_at");
  return { sent };
}

/** À appeler après chaque nouvelle commande valide (jamais bloquant). */
export async function notifyNewOrder(admin: Admin, orderId: string, origin?: string | null) {
  const { notifyStaffOrder } = await import("./staff-push.server");
  await Promise.all([
    notifyStaffOrder(admin, orderId).catch((e) => console.error("staff push", e)),
    sendOrderReceived(admin, orderId, origin).catch((e) => console.error("email reçue", e)),
    sendRestaurantNewOrder(admin, orderId, origin).catch((e) => console.error("email restaurant", e)),
  ]);
  await sendOrderConfirmation(admin, orderId, origin).catch((e) => console.error("email confirmée", e));
}

/** Email de confirmation (une seule fois par commande) avec lien direct vers la facture Factur-X. */
export async function sendOrderConfirmation(admin: Admin, orderId: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false, reason: "brevo_missing" };
  const d = await load(admin, orderId); if (!d) return { sent: false };
  const { o, r } = d;
  if (!o.email || o.confirmation_email_at || !CONFIRMED.includes(o.status)) return { sent: false };
  if (!notificationsOf(r.config).confirmed) return { sent: false, reason: "disabled" };
  if (!(await claim(admin, o.id, "confirmation_email_at"))) return { sent: false };
  const html = orderConfirmedHtml({ ...o, accessToken: issueAccessToken("order", o.id) }, r, baseOf(origin));
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — commande n° ${o.order_number} confirmée`, htmlContent: html }, "order-confirmation");
  if (!ok) { await release(admin, o.id, "confirmation_email_at"); return { sent: false, reason: "brevo_error" }; }
  return { sent: true };
}

/** Email de confirmation de remboursement avec lien vers l'avoir (page de suivi). */
export async function sendRefundEmail(admin: Admin, orderId: string, amount: number, creditNote: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false };
  const { data: o } = await admin.from("orders").select("id, order_number, email, customer_name, first_name, restaurants(slug, name, email, brand, config, logo_url, address, city, phone)").eq("id", orderId).maybeSingle();
  if (!o?.email) return { sent: false };
  const r = o.restaurants as unknown as Rest;
  const html = refundHtml({ ...o, accessToken: issueAccessToken("order", o.id) }, r, baseOf(origin), amount, creditNote);
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — remboursement commande n° ${o.order_number}`, htmlContent: html }, "order-refund");
  return { sent: ok };
}
