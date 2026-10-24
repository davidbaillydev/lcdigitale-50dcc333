// Impression de tickets thermiques (80 mm / 58 mm) via le dialogue d'impression du navigateur.
import { useEffect, useState } from "react";
import { allergenLabel } from "./allergens";

/** Nom du plat suivi de sa taille en majuscules : PIZZA ROYALE [XL]. */
export const itemTitle = (it: { name: string; size?: { name: string } | null }) => (it.size ? `${it.name.toUpperCase()} [${it.size.name.toUpperCase()}]` : it.name);

export type TicketWidth = 80 | 58;
export type TicketKind = "kitchen" | "receipt";
export type TicketOrder = {
  order_number: number; customer_name?: string | null; phone?: string | null; email?: string | null; mode: string;
  address?: string | null; city?: string | null; slot: string; created_at?: string; asap?: boolean; first_name?: string | null; last_name?: string | null;
  items: { name: string; qty: number; total?: number; category?: string; details?: string[]; allergens?: string[]; size?: { name: string } | null; selected_options?: { name: string; price: number }[] }[];
  notes?: string | null; total: number | string; subtotal?: number | string | null; delivery_fee?: number | string | null; service_fee?: number | string | null;
  discount?: number | string | null; promo_code?: string | null;
  payment_method: string; payment_status?: string | null; source?: string | null; table_label?: string | null; room_label?: string | null;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const eur = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;
const time = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const modeLabel = (m: string) => (m === "delivery" ? "LIVRAISON" : m === "dine_in" ? "SUR PLACE" : "À EMPORTER");
/** Ticket client d'une commande non encore réglée : bon de pré-commande non fiscal. */
export const isPreorder = (kind: TicketKind, o: { payment_method: string; payment_status?: string | null }) => kind === "receipt" && !isPaid(o);
export const isPaid = (o: { payment_method: string; payment_status?: string | null }) => o.payment_status ? o.payment_status === "paid" : o.payment_method === "online";
export const payLabel = (p: string, paid = false) =>
  p === "online" ? paid ? "Payé en ligne" : "Paiement en ligne (en attente)" : p === "card_terminal" ? "Carte bancaire (au comptoir)" : p === "counter" ? "Paiement au comptoir" : "Paiement à la remise";

export type KitchenFields = { allergens: boolean; options: boolean; notes: boolean; customer: boolean; contact: boolean; prices: boolean; paid: boolean; qc: boolean };
export type TicketTextSize = "compact" | "normal" | "large";
export type TicketFont = "sans" | "mono" | "condensed";
export type TicketStyle = { textSize?: TicketTextSize; font?: TicketFont };
/** Réglages d'affichage passés aux rendus : champs cuisine + style du texte. */
export type TicketFieldsIn = Partial<KitchenFields> & TicketStyle;
export type PrintingConfig = { width: TicketWidth; /** Ancien réglage global, conservé = autoKitchen || autoReceipt. */ auto: boolean; autoKitchen: boolean; autoReceipt: boolean; textSize: TicketTextSize; font: TicketFont; kitchen: KitchenFields };
export const TICKET_FONTS: Record<TicketFont, string> = {
  sans: "Arial, Helvetica, sans-serif",
  mono: "'Courier New', Courier, monospace",
  condensed: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue Condensed', sans-serif-condensed, Arial, sans-serif",
};
/** Taille de base du texte HTML (px) selon le rouleau et la taille choisie. */
export function ticketFontSize(width: TicketWidth, size: TicketTextSize = "normal") {
  const base = width === 80 ? 15 : 12;
  return size === "large" ? base + 3 : size === "compact" ? base - 2 : base;
}
/** Tickets à imprimer automatiquement à l'arrivée d'une commande. */
export function autoPrintKinds(p: Pick<PrintingConfig, "autoKitchen" | "autoReceipt">): TicketKind[] {
  return [...(p.autoKitchen ? ["kitchen" as const] : []), ...(p.autoReceipt ? ["receipt" as const] : [])];
}
export function autoPrintLabel(p: Pick<PrintingConfig, "autoKitchen" | "autoReceipt">) {
  return p.autoKitchen && p.autoReceipt ? "auto : cuisine + caisse" : p.autoKitchen ? "auto : cuisine seule" : p.autoReceipt ? "auto : caisse seule" : "manuel";
}
/** Style + champs cuisine d'une configuration, prêt à passer aux rendus. */
export const printingFields = (p: Pick<PrintingConfig, "kitchen" | "textSize" | "font">): TicketFieldsIn => ({ ...p.kitchen, textSize: p.textSize, font: p.font });
export type TicketShop = { name: string; address?: string | null; phone?: string | null; slug?: string; customDomains?: string[] | undefined };
export function ticketWebsite(shop: TicketShop) {
  const domain = shop.customDomains?.find((d) => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(d));
  return domain ?? (shop.slug ? `restaurant.lcdigitale.fr/${shop.slug}` : "restaurant.lcdigitale.fr");
}
export function ticketCustomer(o: TicketOrder): [string, string][] {
  const rows: [string, string][] = [];
  if (o.first_name) rows.push(["Prénom:", o.first_name]);
  if (o.last_name) rows.push(["Nom:", o.last_name]);
  if (!o.first_name && !o.last_name && o.customer_name) rows.push(["Nom:", o.customer_name]);
  if (o.email) rows.push(["Email:", o.email]);
  if (o.phone && o.phone !== "-") rows.push(["Téléphone:", o.phone]);
  return rows;
}

export function printingDefaults(p?: Partial<PrintingConfig> | null): PrintingConfig {
  return {
    width: p?.width === 58 ? 58 : 80,
    auto: (p?.autoKitchen ?? p?.auto ?? false) || (p?.autoReceipt ?? p?.auto ?? false),
    autoKitchen: p?.autoKitchen ?? p?.auto ?? false, autoReceipt: p?.autoReceipt ?? p?.auto ?? false,
    textSize: p?.textSize === "large" || p?.textSize === "compact" ? p.textSize : "normal",
    font: p?.font === "mono" || p?.font === "condensed" ? p.font : "sans",
    kitchen: { allergens: false, options: true, notes: true, customer: true, contact: false, prices: false, paid: true, qc: false, ...(p?.kitchen ?? {}) },
  };
}

/** Présentation commune aux tickets HTML et thermiques ; les réglages cuisine restent respectés. */
export function ticketFields(kind: TicketKind, fieldsIn?: TicketFieldsIn): KitchenFields {
  const { textSize: _t, font: _f, ...fields } = fieldsIn ?? {};
  return kind === "receipt"
    ? { allergens: fields?.allergens === true, options: true, notes: true, customer: true, contact: true, prices: true, paid: true, qc: false }
    : { ...printingDefaults().kitchen, ...fields };
}
/** Retire tout préfixe résiduel « Supplément : » / « Supplement : » et les « + » en tête. */
export function cleanOptionLabel(raw: string): string {
  let s = String(raw ?? "").trim();
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/^suppl[eéèê]ments?\s*:?\s*/iu, "").replace(/^\+\s*/, "").trim();
  }
  return s;
}
/** Options d'un article : choix inclus regroupés « Groupe: A, B », extras payants « + Nom (+1,50 €) ». */
export function ticketOptions(it: TicketOrder["items"][number]): string[] {
  const groups = new Map<string, string[]>();
  const order: ({ g: string } | { s: string })[] = [];
  const addChoice = (input: string) => {
    const raw = cleanOptionLabel(input);
    if (!raw) return;
    const m = raw.match(/^([^:]+?)\s*:\s*(.+)$/);
    if (!m) { order.push({ s: raw }); return; }
    const g = (m[1] ?? "").trim(), v = cleanOptionLabel(m[2] ?? "");
    if (!groups.has(g)) { groups.set(g, []); order.push({ g }); }
    groups.get(g)!.push(v);
  };
  const paid: string[] = [];
  for (const d of it.details ?? []) addChoice(d);
  for (const op of it.selected_options ?? []) {
    if (Number(op.price) > 0) {
      const name = cleanOptionLabel(op.name);
      const m = name.match(/^([^:]+?)\s*:\s*(.+)$/);
      paid.push(m ? `${(m[1] ?? "").trim()}: ${cleanOptionLabel(m[2] ?? "")} (+${eur(op.price)})` : `+ ${name} (+${eur(op.price)})`);
    } else addChoice(op.name);
  }
  const choices = order.map((x) => ("g" in x ? `${x.g}: ${groups.get(x.g)!.join(", ")}` : x.s));
  return [...paid.filter((p) => !p.startsWith("+ ")), ...choices, ...paid.filter((p) => p.startsWith("+ "))];
}
export function ticketTotals(o: TicketOrder) {
  const total = Number(o.total);
  const subtotal = o.subtotal != null ? Number(o.subtotal) : Math.round((total - Number(o.delivery_fee ?? 0) - Number(o.service_fee ?? 0) + Number(o.discount ?? 0)) * 100) / 100;
  return { subtotal, vat: Math.round((total - total / 1.1) * 100) / 100, total };
}
export function ticketTiming(o: TicketOrder) {
  const minutes = o.created_at ? Math.max(0, Math.round((Date.parse(o.slot) - Date.parse(o.created_at)) / 60_000)) : 0;
  return { label: o.asap ? "Dès que possible" : "Prévu pour", value: o.asap && Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : time(o.slot) };
}

/** Largeur choisie sur cet appareil (null = pas de choix local). */
export function getDeviceTicketWidth(): TicketWidth | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem("ticket-width"); return v === "58" ? 58 : v === "80" ? 80 : null; } catch { return null; }
}
/** Largeur mémorisée pour l'imprimante directe configurée, le cas échéant. */
export function getPrinterTicketWidth(): TicketWidth | null {
  if (typeof window === "undefined") return null;
  try {
    const p = JSON.parse(localStorage.getItem("lc-direct-printer") ?? "null") as { width?: number } | null;
    return p?.width === 58 ? 58 : p?.width === 80 ? 80 : null;
  } catch { return null; }
}
/** Largeur effective : imprimante configurée en priorité, sinon choix de l'appareil, sinon défaut du restaurant. */
export function getTicketWidth(fallback: TicketWidth = 80): TicketWidth { return getPrinterTicketWidth() ?? getDeviceTicketWidth() ?? fallback; }
export function setTicketWidth(w: TicketWidth) {
  try { localStorage.setItem("ticket-width", String(w)); } catch { /* stockage indisponible */ }
  // Mémorise aussi le format sur l'imprimante directe configurée.
  try {
    const raw = localStorage.getItem("lc-direct-printer");
    if (raw) { const p = JSON.parse(raw); p.width = w; localStorage.setItem("lc-direct-printer", JSON.stringify(p)); }
  } catch { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent("lc-ticket-width", { detail: w }));
}
/** Hook : largeur effective, synchronisée entre composants. */
export function useTicketWidth(fallback: TicketWidth): [TicketWidth, (w: TicketWidth) => void] {
  const [w, setW] = useState<TicketWidth>(fallback);
  useEffect(() => {
    const sync = () => setW(getTicketWidth(fallback));
    sync(); window.addEventListener("lc-ticket-width", sync);
    return () => window.removeEventListener("lc-ticket-width", sync);
  }, [fallback]);
  return [w, setTicketWidth];
}

export function ticketHtml(o: TicketOrder, kind: TicketKind, width: TicketWidth, shopIn: TicketShop | string, fieldsIn?: TicketFieldsIn) {
  const shop = typeof shopIn === "string" ? { name: shopIn } : shopIn;
  const restaurant = shop.name;
  const f = ticketFields(kind, fieldsIn);
  const totals = ticketTotals(o);
  const timing = ticketTiming(o);
  const big = ticketFontSize(width, fieldsIn?.textSize);
  const font = TICKET_FONTS[fieldsIn?.font ?? "sans"];
  const items = o.items.map((it) => `
    <div class="row item"><b>${it.qty}x ${esc(itemTitle(it))}</b>${f.prices && it.total != null ? `<span>${eur(it.total)}</span>` : ""}</div>
    ${(f.options ? ticketOptions(it) : []).map((d) => `<div class="det">${esc(d)}</div>`).join("")}
    ${f.allergens && it.allergens?.length ? `<div class="alg">⚠ ALLERGÈNES : ${it.allergens.map((a) => esc(allergenLabel(a)).toUpperCase()).join(", ")}</div>` : ""}`).join("");
  const allAlg = [...new Set(o.items.flatMap((i) => i.allergens ?? []))];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${o.order_number}</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    :root { --ticket-ink: #000; --ticket-paper: #fff; }
    body { width: ${width}mm; margin: 0; padding: 3mm; font: ${big}px/${fieldsIn?.textSize === "compact" ? 1.15 : 1.3} ${font}; color: var(--ticket-ink); background: var(--ticket-paper); }
    .c { text-align: center; } .xl { font-size: ${big * 2}px; font-weight: bold; } .l { font-size: ${big * 1.3}px; font-weight: bold; }
    body { overflow-wrap: anywhere; }
    .row { display: flex; justify-content: space-between; gap: 4px; margin-top: 4px; }
    .row > :first-child { min-width: 0; } .row > span:last-child { flex-shrink: 0; white-space: nowrap; }
    .item { font-size: ${big + 1}px; font-weight: bold; }
    .cat { margin-top: 8px; font-size: ${big - 3}px; }
    .det { padding-left: 10px; font-size: ${big - 1}px; }
    .customer { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 2px 8px; }
    .customer .value { text-align: right; } .section { margin: 12px 0 4px; font-weight: bold; }
    .promo { border: 1px solid var(--ticket-ink); padding: 10px 5px; margin: 12px 0; text-align: center; font-weight: bold; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .alg { padding-left: 10px; font-size: ${big - 2}px; font-weight: bold; }
    .note { border: 3px double #000; padding: 6px; margin-top: 8px; font-weight: bold; font-size: ${big + 1}px; background: #fff; }
    .box { border: 2px solid #000; padding: 6px; margin-top: 6px; display: flex; justify-content: space-around; font-weight: bold; }
    .ck { display: inline-block; width: 1em; height: 1em; border: 2px solid #000; vertical-align: -2px; margin-right: 4px; text-align: center; line-height: .9em; }
    .band { background: var(--ticket-ink); color: var(--ticket-paper); padding: 4px; margin: 8px 0; font-weight: bold; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .band.row { align-items: start; }
    .sig { margin-top: 14px; border-bottom: 1px dotted #000; height: 1.4em; }
  </style></head><body>
    <div class="c">${kind === "kitchen" ? "TICKET CUISINE" : isPreorder(kind, o) ? "BON DE PRÉ-COMMANDE - À RÉGLER EN CAISSE" : "TICKET CLIENT"}</div>
    <hr><div class="c xl">N° ${o.order_number}</div>
    <div class="band">${payLabel(o.payment_method, isPaid(o))}</div>
    <div class="band row"><span>${esc(timing.label)}</span><span>${esc(timing.value)}</span></div>
    <div class="band">${modeLabel(o.mode)}${o.source === "kiosk" ? " · BORNE" : o.source === "phone" ? " · TÉL IA" : ""}${o.table_label ? ` · TABLE ${esc(o.table_label)}` : ""}${o.room_label ? ` · CHAMBRE ${esc(o.room_label)}` : ""}</div>
    ${f.customer && ticketCustomer(o).length ? `<div class="section">Informations clients:</div><div class="customer">${ticketCustomer(o).map(([label, value]) => `<span>${label}</span><span class="value">${esc(value)}</span>`).join("")}</div>` : ""}
    ${o.mode === "delivery" && o.address ? `<div class="c">${esc(o.address)}, ${esc(o.city)}</div>` : ""}
    <div class="section">Articles:</div>${items}
    ${f.allergens && kind === "kitchen" && allAlg.length ? `<div class="note">ALLERGÈNES COMMANDE : ${allAlg.map((a) => esc(allergenLabel(a))).join(", ")}</div>` : ""}
    ${f.notes && o.notes ? `<div class="note">⚠ REMARQUE CLIENT : ${esc(o.notes)}</div>` : ""}
    <hr>
    ${f.prices ? `<div class="row"><span>Sous total</span><span>${eur(totals.subtotal)}</span></div>` : ""}
    ${f.prices && Number(o.delivery_fee) > 0 ? `<div class="row"><span>Livraison</span><span>${eur(o.delivery_fee)}</span></div>` : ""}
    ${f.prices && Number(o.service_fee) > 0 ? `<div class="row"><span>Frais de service</span><span>${eur(o.service_fee)}</span></div>` : ""}
    ${f.prices && Number(o.discount) > 0 ? `<div class="row"><span>Remise${o.promo_code ? ` ${esc(o.promo_code)}` : ""}</span><span>-${eur(o.discount)}</span></div>` : ""}
    ${f.prices ? `<div class="row"><span>TVA (10 % incluse)</span><span>${eur(totals.vat)}</span></div><div class="row l"><span>TOTAL</span><span>${eur(totals.total)}</span></div>` : ""}
    ${f.paid ? `<div class="box"><span><span class="ck">${isPaid(o) ? "✓" : ""}</span>Payé</span><span><span class="ck">${isPaid(o) ? "" : "✓"}</span>Impayé</span></div>` : ""}
    ${f.qc && kind === "kitchen" ? `<hr><div class="l">Contrôle emballage</div><div><span class="ck"></span>Articles conformes</div><div><span class="ck"></span>Tous les articles</div><div><span class="ck"></span>Couverts / sauces</div><div>Visa :</div><div class="sig"></div>` : ""}
    ${isPreorder(kind, o) ? `<hr><div class="c"><b>Document non fiscal - À régler obligatoirement à la caisse du restaurant avant délivrance de la commande</b></div>` : ""}
    ${kind === "receipt" && !isPreorder(kind, o) ? `<hr><div class="c">Payé — ticket non fiscal, facture disponible sur demande</div><div class="c">Merci de votre commande !</div>` : ""}
    <div class="promo">Commande en ligne:<br>${esc(ticketWebsite(shop))}</div>
    <div class="c l">${esc(restaurant.toUpperCase())}</div>
    ${shop.address ? `<div class="c">${esc(shop.address)}</div>` : ""}
    ${shop.phone ? `<div class="c">${esc(shop.phone)}</div>` : ""}
    <div class="c" style="margin-top:6px">${new Date().toLocaleString("fr-FR")}</div>
  </body></html>`;
}

/** Imprime directement sur l'imprimante ESC/POS de l'appareil si elle est configurée, sinon via le navigateur. */
export async function printTickets(o: TicketOrder, kinds: TicketKind[], shopIn: TicketShop | string, width: TicketWidth = getTicketWidth(), fields?: TicketFieldsIn): Promise<boolean> {
  const { getPrinter, sendToPrinter } = await import("./printer");
  const p = getPrinter();
  if (p) {
    const { ticketEscpos } = await import("./escpos");
    const shop = typeof shopIn === "string" ? { name: shopIn } : shopIn;
    try { for (const k of kinds) await sendToPrinter(p, ticketEscpos(o, k, width, shop, fields)); return true; }
    catch (e) { console.warn("Impression directe échouée", e); return false; }
  }
  return printBrowser(o, kinds, shopIn, width, fields);
}

function printBrowser(o: TicketOrder, kinds: TicketKind[], shop: TicketShop | string, width: TicketWidth, fields?: TicketFieldsIn): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = kinds.map((k) => ticketHtml(o, k, width, shop, fields)).join("");
      const body = html.replace(/<\/body><\/html><!doctype html><html><head>[\s\S]*?<body>/g, '<div style="page-break-before:always"></div>');
      const fr = document.createElement("iframe");
      fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(fr);
      const d = fr.contentDocument;
      const w = fr.contentWindow;
      if (!d || !w) { fr.remove(); return resolve(false); }
      d.open(); d.write(body); d.close();
      setTimeout(() => {
        try { w.focus(); w.print(); resolve(true); } catch { resolve(false); }
        setTimeout(() => fr.remove(), 60_000);
      }, 250);
    } catch { resolve(false); }
  });
}

/** Commande fictive pour l'aperçu et le ticket de test. */
export function sampleOrder(): TicketOrder {
  const now = new Date().toISOString();
  return {
    order_number: 999, customer_name: "Client test", phone: "06 00 00 00 00", mode: "pickup", slot: now, created_at: now,
    items: [
      { name: "Wok poulet", qty: 2, total: 25.8, category: "Woks signatures", details: ["Base : Nouilles sautées"], selected_options: [{ name: "Sauce piquante", price: 1 }] },
      { name: "California saumon", qty: 1, total: 6.5, category: "California x8", details: ["Choix : Sans sésame"], allergens: ["poissons", "sesame", "soja"] },
    ],
    notes: "TICKET DE TEST", total: 30.3, payment_method: "on_site", source: "web",
  };
}
