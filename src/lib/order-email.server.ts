type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

import { emailLayout, emailButton, escHtml } from "@/lib/email-layout";

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const FALLBACK_ORIGIN = "https://restaurant.lcdigitale.fr";
const CONFIRMED = ["accepted", "preparing", "ready", "delivering", "done"];
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const baseOf = (origin?: string | null) => (/^https?:\/\/[^/]+$/.test(origin ?? "") ? origin! : FALLBACK_ORIGIN);
const MODE: Record<string, string> = { delivery: "Livraison", dine_in: "Sur place", pickup: "À emporter" };

export type NotificationSettings = { received: boolean; confirmed: boolean; restaurant: boolean; email?: string | undefined };
/** Interrupteurs de notification (absents = actifs). */
export function notificationsOf(config: unknown): NotificationSettings {
  const n = ((config as { notifications?: Partial<NotificationSettings> } | null)?.notifications) ?? {};
  return { received: n.received !== false, confirmed: n.confirmed !== false, restaurant: n.restaurant !== false, email: n.email || undefined };
}

type Line = { name: string; qty: number; total: number; size?: string; details?: string | string[] };
type Rest = { slug: string; name: string; email: string | null; brand: { accent?: string } | null; config: unknown; logo_url?: string | null; address?: string | null; city?: string | null; phone?: string | null };
const ORDER_COLS = "id, is_test, order_number, status, mode, slot, asap, total, items, notes, email, phone, customer_name, first_name, last_name, address, postal_code, city, table_label, payment_method, payment_status, confirmation_email_at, received_email_at, restaurant_email_at, restaurants(slug, name, email, brand, config, logo_url, address, city, phone)";

async function load(admin: Admin, orderId: string) {
  const { data: o } = await admin.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle();
  if (!o || o.is_test) return null;
  return { o, r: o.restaurants as unknown as Rest };
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
const colorOf = (r: Rest) => (/^#[0-9a-f]{6}$/i.test(r.brand?.accent ?? "") ? r.brand!.accent! : "#007af5");
const firstName = (o: { first_name: string | null; customer_name: string }) => o.first_name?.trim() || o.customer_name.split(" ")[0] || "";
const lineDetails = (i: Line) => { const d = Array.isArray(i.details) ? i.details.join(", ") : i.details; return d ? `<div style="color:#6b7280;font-size:13px;margin-top:2px">${esc(d)}</div>` : ""; };
const itemsTable = (items: Line[], total: number) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;margin:20px 0;background:#fafafa;border-radius:10px">${items.map((i) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #eeeeee"><b>${i.qty} ×</b> ${esc(i.name)}${i.size ? ` <span style="color:#6b7280">(${esc(i.size)})</span>` : ""}${lineDetails(i)}</td><td style="padding:10px 14px;text-align:right;vertical-align:top;white-space:nowrap;border-bottom:1px solid #eeeeee">${eur(i.total)}</td></tr>`).join("")}
<tr><td style="padding:12px 14px;font-size:16px"><b>Total TTC</b></td><td style="padding:12px 14px;text-align:right;font-size:16px;white-space:nowrap"><b>${eur(total)}</b></td></tr></table>`;
const brandOf = (r: Rest) => ({ name: r.name, color: colorOf(r), logoUrl: r.logo_url, address: r.address, city: r.city, phone: r.phone });
const infoBox = (rows: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:8px 0">${rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:#6b7280;width:38%;vertical-align:top">${k}</td><td style="padding:4px 0;color:#111827;font-weight:bold">${v}</td></tr>`).join("")}</table>`;
const slotText = (o: { slot: string; asap: boolean }) => o.asap ? "Dès que possible" : new Date(o.slot).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** « Commande reçue » (client) : création en paiement sur place ou paiement en ligne confirmé. */
export async function sendOrderReceived(admin: Admin, orderId: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false };
  const d = await load(admin, orderId); if (!d) return { sent: false };
  const { o, r } = d;
  if (!o.email || o.received_email_at || o.status === "awaiting_payment" || o.status === "cancelled") return { sent: false };
  if (!notificationsOf(r.config).received) return { sent: false, reason: "disabled" };
  if (!(await claim(admin, o.id, "received_email_at"))) return { sent: false };
  const color = colorOf(r), track = `${baseOf(origin)}/${r.slug}/suivi/${o.id}`;
  const paid = o.payment_status === "paid";
  const html = emailLayout(brandOf(r), {
    preheader: `Commande n° ${o.order_number} bien reçue`,
    title: "Merci, votre commande est bien reçue",
    body: `<p style="margin:0 0 12px">Bonjour ${esc(firstName(o))},</p>
<p style="margin:0 0 12px">Le restaurant va confirmer votre commande dans quelques instants. Vous recevrez un e-mail dès qu'elle sera acceptée.</p>
${infoBox([["Commande", `n° ${o.order_number}`], ["Mode", MODE[o.mode] ?? o.mode], ...(o.mode !== "dine_in" ? [["Heure", esc(slotText(o))] as [string, string]] : []), ["Règlement", paid ? "Payé en ligne" : "À régler sur place"]])}
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
${emailButton(track, "Suivre ma commande", color)}`,
    footer: "Une question ? Répondez simplement à cet e-mail.",
  });
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
  const to = n.email || r.email;
  if (!n.restaurant || !to) return { sent: false, reason: n.restaurant ? "no_email" : "disabled" };
  if (!(await claim(admin, o.id, "restaurant_email_at"))) return { sent: false };
  const color = colorOf(r);
  const paid = o.payment_status === "paid";
  const name = [o.first_name, o.last_name].filter(Boolean).join(" ") || o.customer_name;
  const rows: [string, string][] = [
    ["Mode", `${MODE[o.mode] ?? o.mode}${o.table_label ? ` — table ${esc(o.table_label)}` : ""}`],
    ["Créneau", esc(slotText(o))],
    ["Client", esc(name)],
    ["Téléphone", esc(o.phone)],
    ...(o.email ? [["E-mail", esc(o.email)] as [string, string]] : []),
    ...(o.mode === "delivery" ? [["Adresse", esc([o.address, o.postal_code, o.city].filter(Boolean).join(", "))] as [string, string]] : []),
    ["Règlement", paid ? "Payé en ligne" : "À encaisser sur place"],
  ];
  const html = emailLayout(brandOf(r), {
    preheader: `${MODE[o.mode] ?? o.mode} — ${eur(Number(o.total))}`,
    title: `Nouvelle commande n° ${o.order_number}`,
    body: `${infoBox(rows)}
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
${o.notes ? `<p style="margin:0 0 12px;padding:12px 14px;background:#fff7ed;border-radius:10px;font-size:14px"><b>Remarque du client :</b> ${esc(o.notes)}</p>` : ""}
${emailButton(`${baseOf(origin)}/espace/${r.slug}`, "Ouvrir l'écran cuisine", color)}`,
    footer: "Notification automatique LC Digitale.",
  });
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: "LC Digitale" }, to: [{ email: to, name: r.name }], ...(o.email ? { replyTo: { email: o.email, name } } : {}), subject: `Nouvelle commande n° ${o.order_number} — ${name}`, htmlContent: html }, "order-restaurant");
  if (!ok) await release(admin, o.id, "restaurant_email_at");
  return { sent: ok };
}

/** À appeler après chaque nouvelle commande valide (jamais bloquant). */
export async function notifyNewOrder(admin: Admin, orderId: string, origin?: string | null) {
  await Promise.all([
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
  const color = colorOf(r);
  const track = `${baseOf(origin)}/${r.slug}/suivi/${o.id}`;
  const invoice = `${track}?facture=1`;
  const html = emailLayout(brandOf(r), {
    preheader: `Commande n° ${o.order_number} confirmée par ${r.name}`,
    title: "Votre commande est confirmée ✓",
    body: `<p style="margin:0 0 12px">Bonjour ${esc(firstName(o))},</p>
<p style="margin:0 0 12px">Bonne nouvelle : le restaurant a confirmé votre commande et s'occupe de la préparer.</p>
${infoBox([["Commande", `n° ${o.order_number}`], ["Mode", MODE[o.mode] ?? o.mode], ...(o.mode !== "dine_in" ? [["Heure", esc(slotText(o))] as [string, string]] : [])])}
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
${emailButton(track, "Suivre ma commande", color)}
<p style="text-align:center;font-size:13px;margin:4px 0 0"><a href="${invoice}" style="color:${color}">Télécharger ma facture (PDF)</a></p>`,
    footer: "Conservez cet e-mail : il donne accès à votre facture. Une question ? Répondez simplement à ce message.",
  });
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
  const track = `${baseOf(origin)}/${r.slug}/suivi/${o.id}`;
  const html = emailLayout(brandOf(r), {
    preheader: `Remboursement de ${eur(amount)} effectué`,
    title: "Votre remboursement est en route",
    body: `<p style="margin:0 0 12px">Bonjour ${esc(firstName(o))},</p>
<p style="margin:0 0 12px">Nous avons remboursé votre commande <b>n° ${o.order_number}</b> sur le moyen de paiement utilisé.</p>
${infoBox([["Montant remboursé", eur(amount)], ["Avoir", esc(creditNote)], ["Délai bancaire", "5 à 10 jours ouvrés"]])}
${emailButton(track, "Télécharger mon avoir", colorOf(r))}`,
    footer: "Une question ? Répondez simplement à cet e-mail.",
  });
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — remboursement commande n° ${o.order_number}`, htmlContent: html }, "order-refund");
  return { sent: ok };
}
