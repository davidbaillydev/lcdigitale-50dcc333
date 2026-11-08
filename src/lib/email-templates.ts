/** Contenu HTML des e-mails transactionnels et marketing — pur, partagé entre l'envoi serveur et l'aperçu agence. */
import { formatMoney, type Currency } from "./money";
import { emailLayout, emailButton, escHtml as esc, brandColor, type EmailBrand } from "@/lib/email-layout";

export type EmailLine = { name: string; qty: number; total: number; size?: string; details?: string | string[] };
export type EmailRestaurant = { slug: string; name: string; brand: { accent?: string } | null; logo_url?: string | null | undefined; address?: string | null | undefined; city?: string | null | undefined; phone?: string | null | undefined };
export type EmailOrder = {
  accessToken?: string;
  currency?: Currency;
  id: string; order_number: number | string; mode: string; slot: string; asap: boolean; total: number | string; items: unknown;
  notes?: string | null; email?: string | null; phone: string; customer_name: string; first_name: string | null; last_name?: string | null;
  address?: string | null; postal_code?: string | null; city?: string | null; table_label?: string | null; payment_status?: string | null;
};

const eur = (n: number, currency: Currency = "EUR") => formatMoney(Number(n), currency);
const MODE: Record<string, string> = { delivery: "Livraison", dine_in: "Sur place", pickup: "À emporter" };
const colorOf = (r: EmailRestaurant) => brandColor(r.brand?.accent, "#007af5");
const brandOf = (r: EmailRestaurant): EmailBrand => ({ name: r.name, color: colorOf(r), logoUrl: r.logo_url, address: r.address, city: r.city, phone: r.phone });
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const firstName = (o: { first_name: string | null; customer_name: string }) => capFirst(o.first_name?.trim() || o.customer_name.split(" ")[0] || "");
/** Formule d'accueil : « Bonjour Alexia, » si un prénom est connu, sinon « Bonjour, » — jamais « Bonjour client, ». */
export const greetingText = (name?: string | null) => { const first = capFirst((name ?? "").trim().split(" ")[0] ?? ""); return first ? `Bonjour ${esc(first)},` : "Bonjour,"; };
const lineDetails = (i: EmailLine) => { const d = Array.isArray(i.details) ? i.details.join(", ") : i.details; return d ? `<div style="color:#6b7280;font-size:13px;margin-top:2px">${esc(d)}</div>` : ""; };
const itemsTable = (items: EmailLine[], total: number, currency: Currency = "EUR") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;margin:20px 0;background:#fafafa;border-radius:10px">${items.map((i) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #eeeeee"><b>${i.qty} ×</b> ${esc(i.name)}${i.size ? ` <span style="color:#6b7280">(${esc(i.size)})</span>` : ""}${lineDetails(i)}</td><td style="padding:10px 14px;text-align:right;vertical-align:top;white-space:nowrap;border-bottom:1px solid #eeeeee">${eur(i.total, currency)}</td></tr>`).join("")}
<tr><td style="padding:12px 14px;font-size:16px"><b>Total TTC</b></td><td style="padding:12px 14px;text-align:right;font-size:16px;white-space:nowrap"><b>${eur(total, currency)}</b></td></tr></table>`;
const infoBox = (rows: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:8px 0">${rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:#6b7280;width:38%;vertical-align:top">${k}</td><td style="padding:4px 0;color:#111827;font-weight:bold">${v}</td></tr>`).join("")}</table>`;
const slotText = (o: { slot: string; asap: boolean }) => o.asap ? "Dès que possible" : new Date(o.slot).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const items = (o: EmailOrder) => itemsTable((o.items as EmailLine[]) ?? [], Number(o.total), o.currency ?? "EUR");
const trackUrl = (base: string, r: EmailRestaurant, o: { id: string; accessToken?: string }) => `${base}/${r.slug}/suivi/${o.id}${o.accessToken ? `?access=${encodeURIComponent(o.accessToken)}` : ""}`;

export function orderReceivedHtml(o: EmailOrder, r: EmailRestaurant, base: string) {
  const paid = o.payment_status === "paid";
  return emailLayout(brandOf(r), {
    preheader: `Commande n° ${o.order_number} bien reçue`,
    title: "Merci, votre commande est bien reçue",
    body: `<p style="margin:0 0 12px">${greetingText(firstName(o))}</p>
<p style="margin:0 0 12px">Le restaurant va confirmer votre commande dans quelques instants. Vous recevrez un e-mail dès qu'elle sera acceptée.</p>
${infoBox([["Commande", `n° ${o.order_number}`], ["Mode", MODE[o.mode] ?? o.mode], ...(o.mode !== "dine_in" ? [["Heure", esc(slotText(o))] as [string, string]] : []), ["Règlement", paid ? "Payé en ligne" : "À régler sur place"]])}
${items(o)}
${emailButton(trackUrl(base, r, o), "Suivre ma commande", colorOf(r))}`,
    footer: "Une question ? Répondez simplement à cet e-mail.",
  });
}

export function restaurantNewOrderHtml(o: EmailOrder, r: EmailRestaurant, base: string) {
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
  return emailLayout(brandOf(r), {
    preheader: `${MODE[o.mode] ?? o.mode} — ${eur(Number(o.total), o.currency ?? "EUR")}`,
    title: `Nouvelle commande n° ${o.order_number}`,
    body: `${infoBox(rows)}
${items(o)}
${o.notes ? `<p style="margin:0 0 12px;padding:12px 14px;background:#fff7ed;border-radius:10px;font-size:14px"><b>Remarque du client :</b> ${esc(o.notes)}</p>` : ""}
${emailButton(`${base}/espace/${r.slug}`, "Ouvrir l'écran cuisine", colorOf(r))}`,
    footer: "Notification automatique LC Digitale.",
  });
}

export function orderConfirmedHtml(o: EmailOrder, r: EmailRestaurant, base: string) {
  const color = colorOf(r), track = trackUrl(base, r, o);
  return emailLayout(brandOf(r), {
    preheader: `Commande n° ${o.order_number} confirmée par ${r.name}`,
    title: "Votre commande est confirmée ✓",
    body: `<p style="margin:0 0 12px">${greetingText(firstName(o))}</p>
<p style="margin:0 0 12px">Bonne nouvelle : le restaurant a confirmé votre commande et s'occupe de la préparer.</p>
${infoBox([["Commande", `n° ${o.order_number}`], ["Mode", MODE[o.mode] ?? o.mode], ...(o.mode !== "dine_in" ? [["Heure", esc(slotText(o))] as [string, string]] : [])])}
${items(o)}
${emailButton(track, "Suivre ma commande", color)}
<p style="text-align:center;font-size:13px;margin:4px 0 0"><a href="${track}${track.includes("?") ? "&" : "?"}facture=1" style="color:${color}">Télécharger ma facture (PDF)</a></p>`,
    footer: "Conservez cet e-mail : il donne accès à votre facture. Une question ? Répondez simplement à ce message.",
  });
}

export function refundHtml(o: { accessToken?: string; id: string; order_number: number | string; first_name: string | null; customer_name: string }, r: EmailRestaurant, base: string, amount: number, creditNote: string) {
  return emailLayout(brandOf(r), {
    preheader: `Remboursement de ${eur(amount)} effectué`,
    title: "Votre remboursement est en route",
    body: `<p style="margin:0 0 12px">${greetingText(firstName(o))}</p>
<p style="margin:0 0 12px">Nous avons remboursé votre commande <b>n° ${o.order_number}</b> sur le moyen de paiement utilisé.</p>
${infoBox([["Montant remboursé", eur(amount)], ["Avoir", esc(creditNote)], ["Délai bancaire", "5 à 10 jours ouvrés"]])}
${emailButton(trackUrl(base, r, o), "Télécharger mon avoir", colorOf(r))}`,
    footer: "Une question ? Répondez simplement à cet e-mail.",
  });
}

export function campaignHtml(o: { restaurant: string; body: string; ctaUrl?: string | undefined; ctaLabel?: string | undefined; color?: string | undefined; subject?: string | undefined; brand?: Omit<EmailBrand, "name" | "color"> | undefined }) {
  const color = brandColor(o.color, "#c8102e");
  const body = esc(o.body).replace(/\n/g, "<br>");
  return emailLayout({ name: o.restaurant, color, ...(o.brand ?? {}) }, {
    preheader: o.subject,
    title: o.subject || `Des nouvelles de ${o.restaurant}`,
    body: `<p style="margin:0 0 12px">{{params.greeting}}</p><p style="margin:0 0 12px">${body}</p>${o.ctaUrl ? emailButton(o.ctaUrl, o.ctaLabel || "Commander", color) : ""}`,
    footer: `Vous recevez cet e-mail car vous avez accepté les offres de ${esc(o.restaurant)}.<br><a href="{{params.unsub}}" style="color:#6b7280">Se désabonner</a>`,
  });
}
