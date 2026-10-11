type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const FALLBACK_ORIGIN = "https://restaurant.lcdigitale.fr";
const CONFIRMED = ["accepted", "preparing", "ready", "delivering", "done"];
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const baseOf = (origin?: string | null) => (/^https?:\/\/[^/]+$/.test(origin ?? "") ? origin! : FALLBACK_ORIGIN);
const MODE: Record<string, string> = { delivery: "Livraison", dine_in: "Sur place", pickup: "À emporter" };

export type NotificationSettings = { received: boolean; confirmed: boolean; restaurant: boolean; email?: string };
/** Interrupteurs de notification (absents = actifs). */
export function notificationsOf(config: unknown): NotificationSettings {
  const n = ((config as { notifications?: Partial<NotificationSettings> } | null)?.notifications) ?? {};
  return { received: n.received !== false, confirmed: n.confirmed !== false, restaurant: n.restaurant !== false, email: n.email || undefined };
}

type Line = { name: string; qty: number; total: number; size?: string; details?: string | string[] };
type Rest = { slug: string; name: string; email: string | null; brand: { accent?: string } | null; config: unknown };
const ORDER_COLS = "id, order_number, status, mode, slot, asap, total, items, notes, email, phone, customer_name, first_name, last_name, address, postal_code, city, table_label, payment_method, payment_status, confirmation_email_at, received_email_at, restaurant_email_at, restaurants(slug, name, email, brand, config)";

async function load(admin: Admin, orderId: string) {
  const { data: o } = await admin.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle();
  if (!o) return null;
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
const lineDetails = (i: Line) => { const d = Array.isArray(i.details) ? i.details.join(", ") : i.details; return d ? `<br><span style="color:#666;font-size:12px">${esc(d)}</span>` : ""; };
const itemsTable = (items: Line[], total: number) => `<table style="width:100%;font-size:14px;border-collapse:collapse">${items.map((i) => `<tr><td style="padding:4px 0">${i.qty} × ${esc(i.name)}${i.size ? ` [${esc(i.size)}]` : ""}${lineDetails(i)}</td><td style="text-align:right;vertical-align:top">${eur(i.total)}</td></tr>`).join("")}
<tr><td style="padding-top:8px;border-top:1px solid #eee"><b>Total TTC</b></td><td style="text-align:right;padding-top:8px;border-top:1px solid #eee"><b>${eur(total)}</b></td></tr></table>`;
const wrap = (inner: string) => `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#222"><div style="max-width:560px;margin:0 auto;padding:24px">${inner}</div></body></html>`;
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
  const html = wrap(`<h1 style="font-size:22px;color:${color};margin:0 0 12px">${esc(r.name)}</h1>
<p style="font-size:15px">Bonjour ${esc(firstName(o))},</p>
<p style="font-size:15px">Nous avons bien reçu votre commande <b>n° ${o.order_number}</b> (${MODE[o.mode] ?? o.mode}${o.mode !== "dine_in" ? ` — ${esc(slotText(o))}` : ""}). Le restaurant va la confirmer très vite.</p>
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
<p style="font-size:14px">${paid ? "Paiement en ligne reçu." : "Paiement à régler sur place."}</p>
<p style="text-align:center;margin:28px 0 12px"><a href="${track}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Suivre ma commande</a></p>`);
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
  const addr = o.mode === "delivery" ? `<p style="font-size:14px"><b>Adresse :</b> ${esc([o.address, o.postal_code, o.city].filter(Boolean).join(", "))}</p>` : "";
  const html = wrap(`<h1 style="font-size:22px;color:${color};margin:0 0 12px">Nouvelle commande n° ${o.order_number}</h1>
<p style="font-size:14px"><b>Mode :</b> ${MODE[o.mode] ?? o.mode}${o.table_label ? ` — table ${esc(o.table_label)}` : ""}<br><b>Créneau :</b> ${esc(slotText(o))}</p>
<p style="font-size:14px"><b>Client :</b> ${esc(name)}<br><b>Téléphone :</b> ${esc(o.phone)}${o.email ? `<br><b>Email :</b> ${esc(o.email)}` : ""}</p>
${addr}
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
${o.notes ? `<p style="font-size:14px"><b>Remarques :</b> ${esc(o.notes)}</p>` : ""}
<p style="font-size:15px"><b>${paid ? "Payé en ligne" : "À payer sur place"}</b></p>
<p style="text-align:center;margin:28px 0 12px"><a href="${baseOf(origin)}/espace/${r.slug}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Ouvrir l'écran cuisine</a></p>`);
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
  const html = wrap(`<h1 style="font-size:22px;color:${color};margin:0 0 12px">${esc(r.name)}</h1>
<p style="font-size:15px">Bonjour ${esc(firstName(o))},</p>
<p style="font-size:15px">Votre commande <b>n° ${o.order_number}</b> est confirmée (${MODE[o.mode] ?? o.mode}).</p>
${itemsTable((o.items as Line[]) ?? [], Number(o.total))}
<p style="text-align:center;margin:28px 0 12px"><a href="${invoice}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Télécharger ma facture (PDF / Factur-X)</a></p>
<p style="text-align:center;font-size:13px"><a href="${track}" style="color:${color}">Suivre ma commande</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px">
<p style="font-size:11px;color:#888">Email envoyé suite à votre commande chez ${esc(r.name)}. Conservez ce lien : il donne accès à votre facture.</p>`);
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — commande n° ${o.order_number} confirmée`, htmlContent: html }, "order-confirmation");
  if (!ok) { await release(admin, o.id, "confirmation_email_at"); return { sent: false, reason: "brevo_error" }; }
  return { sent: true };
}

/** Email de confirmation de remboursement avec lien vers l'avoir (page de suivi). */
export async function sendRefundEmail(admin: Admin, orderId: string, amount: number, creditNote: string, origin?: string | null) {
  if (!brevoReady()) return { sent: false };
  const { data: o } = await admin.from("orders").select("id, order_number, email, customer_name, first_name, restaurants(slug, name, email)").eq("id", orderId).maybeSingle();
  if (!o?.email) return { sent: false };
  const r = o.restaurants as unknown as { slug: string; name: string; email: string | null };
  const track = `${baseOf(origin)}/${r.slug}/suivi/${o.id}`;
  const html = wrap(`<h1 style="font-size:20px">${esc(r.name)} — remboursement de votre commande n° ${o.order_number}</h1>
<p>Bonjour ${esc(firstName(o))},</p>
<p>Nous avons remboursé <strong>${eur(amount)}</strong> sur le moyen de paiement utilisé lors de votre commande. Le crédit apparaît généralement sous 5 à 10 jours ouvrés selon votre banque.</p>
<p>Votre avoir <strong>${esc(creditNote)}</strong> est téléchargeable ici : <a href="${track}">${track}</a></p>`);
  const ok = await brevo({ sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}), to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — remboursement commande n° ${o.order_number}`, htmlContent: html }, "order-refund");
  return { sent: ok };
}
