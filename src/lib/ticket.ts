// Impression de tickets thermiques (80 mm / 58 mm) via le dialogue d'impression du navigateur.
import { allergenLabel } from "./allergens";

/** Nom du plat suivi de sa taille en majuscules : PIZZA ROYALE [XL]. */
export const itemTitle = (it: { name: string; size?: { name: string } | null }) => (it.size ? `${it.name.toUpperCase()} [${it.size.name.toUpperCase()}]` : it.name);

export type TicketWidth = 80 | 58;
export type TicketKind = "kitchen" | "receipt";
export type TicketOrder = {
  order_number: number; customer_name?: string | null; phone?: string | null; mode: string;
  address?: string | null; city?: string | null; slot: string; created_at?: string;
  items: { name: string; qty: number; total?: number; details?: string[]; allergens?: string[]; size?: { name: string } | null; selected_options?: { name: string; price: number }[] }[];
  notes?: string | null; total: number | string; delivery_fee?: number | string | null; service_fee?: number | string | null;
  discount?: number | string | null; promo_code?: string | null;
  payment_method: string; payment_status?: string | null; source?: string | null; table_label?: string | null; room_label?: string | null;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const eur = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;
const time = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const modeLabel = (m: string) => (m === "delivery" ? "LIVRAISON" : m === "dine_in" ? "SUR PLACE" : "À EMPORTER");
/** Ticket client d'une commande non encore réglée : bon de pré-commande non fiscal. */
export const isPreorder = (kind: TicketKind, o: { payment_method: string; payment_status?: string | null }) => kind === "receipt" && !isPaid(o);
export const isPaid = (o: { payment_method: string; payment_status?: string | null }) => o.payment_status ? o.payment_status === "paid" : o.payment_method === "online";
const payLabel = (p: string) =>
  p === "online" ? "Payé en ligne" : p === "card_terminal" ? "CB au comptoir" : p === "counter" ? "Espèces/TR au comptoir" : "À encaisser";

export type KitchenFields = { allergens: boolean; options: boolean; notes: boolean; customer: boolean; contact: boolean; prices: boolean; paid: boolean; qc: boolean };
export type PrintingConfig = { width: TicketWidth; auto: boolean; kitchen: KitchenFields };
export type TicketShop = { name: string; address?: string | null; phone?: string | null };

export function printingDefaults(p?: Partial<PrintingConfig> | null): PrintingConfig {
  return {
    width: p?.width === 58 ? 58 : 80, auto: p?.auto ?? false,
    kitchen: { allergens: true, options: true, notes: true, customer: true, contact: false, prices: false, paid: true, qc: false, ...(p?.kitchen ?? {}) },
  };
}

export function getTicketWidth(): TicketWidth {
  if (typeof window === "undefined") return 80;
  return localStorage.getItem("ticket-width") === "58" ? 58 : 80;
}
export function setTicketWidth(w: TicketWidth) { localStorage.setItem("ticket-width", String(w)); }

export function ticketHtml(o: TicketOrder, kind: TicketKind, width: TicketWidth, shopIn: TicketShop | string, fieldsIn?: Partial<KitchenFields>) {
  const shop = typeof shopIn === "string" ? { name: shopIn } : shopIn;
  const restaurant = shop.name;
  const f: KitchenFields = kind === "receipt"
    ? { allergens: true, options: true, notes: true, customer: true, contact: true, prices: true, paid: true, qc: false }
    : { ...printingDefaults().kitchen, ...(fieldsIn ?? {}) };
  const big = width === 80 ? 15 : 12;
  const items = o.items.map((it) => `
    <div class="row"><b>${it.qty}× ${esc(itemTitle(it))}</b>${f.prices && it.total != null ? `<span>${eur(it.total)}</span>` : ""}</div>
    ${(f.options ? it.details ?? [] : []).map((d) => `<div class="det">${esc(d)}</div>`).join("")}
    ${(f.options ? it.selected_options ?? [] : []).map((op) => `<div class="row det"><b>+ ${esc(op.name)}</b>${f.prices && op.price ? `<span>+${eur(op.price)}</span>` : ""}</div>`).join("")}
    ${f.allergens && it.allergens?.length ? `<div class="alg">⚠ ALLERGÈNES : ${it.allergens.map((a) => esc(allergenLabel(a)).toUpperCase()).join(", ")}</div>` : ""}`).join("");
  const allAlg = [...new Set(o.items.flatMap((i) => i.allergens ?? []))];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${o.order_number}</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: ${width}mm; margin: 0; padding: 3mm; font: ${big}px/1.3 "Courier New", monospace; color: #000; background: #fff; }
    .c { text-align: center; } .xl { font-size: ${big * 2}px; font-weight: bold; } .l { font-size: ${big * 1.3}px; font-weight: bold; }
    .row { display: flex; justify-content: space-between; gap: 4px; margin-top: 4px; }
    .det { padding-left: 10px; font-size: ${big - 2}px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .alg { padding-left: 10px; font-size: ${big - 2}px; font-weight: bold; }
    .note { border: 2px solid #000; padding: 4px; margin-top: 6px; font-weight: bold; }
    .box { border: 2px solid #000; padding: 6px; margin-top: 6px; display: flex; justify-content: space-around; font-weight: bold; }
    .ck { display: inline-block; width: 1em; height: 1em; border: 2px solid #000; vertical-align: -2px; margin-right: 4px; text-align: center; line-height: .9em; }
    .band { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; text-align: center; margin-top: 4px; }
    .sig { margin-top: 14px; border-bottom: 1px dotted #000; height: 1.4em; }
  </style></head><body>
    <div class="c l">${esc(restaurant)}</div>
    ${f.contact && (shop.address || shop.phone) ? `<div class="c">${esc(shop.address)}${shop.address && shop.phone ? "<br>" : ""}${esc(shop.phone)}</div>` : ""}
    <div class="c">${kind === "kitchen" ? "TICKET CUISINE" : isPreorder(kind, o) ? "BON DE PRÉ-COMMANDE - À RÉGLER EN CAISSE" : "TICKET CLIENT"}</div>
    <hr><div class="c xl">N° ${o.order_number}</div>
    <div class="c l">${modeLabel(o.mode)}${o.source === "kiosk" ? " · BORNE" : ""}${o.table_label ? ` · TABLE ${esc(o.table_label)}` : ""}${o.room_label ? ` · CHAMBRE ${esc(o.room_label)}` : ""}</div>
    <div class="band">Pour ${time(o.slot)}${o.created_at ? ` · reçue ${time(o.created_at)}` : ""}</div>
    ${f.customer && o.customer_name ? `<div class="c">${esc(o.customer_name)}${o.phone && o.phone !== "-" ? ` · ${esc(o.phone)}` : ""}</div>` : ""}
    ${o.mode === "delivery" && o.address ? `<div class="c">${esc(o.address)}, ${esc(o.city)}</div>` : ""}
    <hr>${items}
    ${f.allergens && kind === "kitchen" && allAlg.length ? `<div class="note">ALLERGÈNES COMMANDE : ${allAlg.map((a) => esc(allergenLabel(a))).join(", ")}</div>` : ""}
    ${f.notes && o.notes ? `<div class="note">⚠ REMARQUE CLIENT : ${esc(o.notes)}</div>` : ""}
    <hr>
    ${f.prices && Number(o.delivery_fee) > 0 ? `<div class="row"><span>Livraison</span><span>${eur(o.delivery_fee)}</span></div>` : ""}
    ${f.prices && Number(o.service_fee) > 0 ? `<div class="row"><span>Frais de service</span><span>${eur(o.service_fee)}</span></div>` : ""}
    ${f.prices && Number(o.discount) > 0 ? `<div class="row"><span>Remise${o.promo_code ? ` ${esc(o.promo_code)}` : ""}</span><span>-${eur(o.discount)}</span></div>` : ""}
    ${f.prices ? `<div class="row l"><span>TOTAL</span><span>${eur(o.total)}</span></div>` : ""}
    ${f.prices ? `<div class="row"><span>dont TVA (10 % incluse)</span><span>${eur(Number(o.total) - Number(o.total) / 1.1)}</span></div>` : ""}
    <div>${payLabel(o.payment_method)}</div>
    ${f.paid && !isPreorder(kind, o) ? `<div class="box"><span><span class="ck">${isPaid(o) ? "✓" : ""}</span>Payé</span><span><span class="ck">${isPaid(o) ? "" : "✓"}</span>Non payé</span></div>` : ""}
    ${f.qc && kind === "kitchen" ? `<hr><div class="l">Contrôle emballage</div><div><span class="ck"></span>Articles conformes</div><div><span class="ck"></span>Tous les articles</div><div><span class="ck"></span>Couverts / sauces</div><div>Visa :</div><div class="sig"></div>` : ""}
    ${isPreorder(kind, o) ? `<hr><div class="c"><b>Document non fiscal - À régler obligatoirement à la caisse du restaurant avant délivrance de la commande</b></div>` : ""}
    ${kind === "receipt" && !isPreorder(kind, o) ? `<hr><div class="c">Payé — ticket non fiscal, facture disponible sur demande</div><div class="c">Merci de votre commande !</div>` : ""}
    <div class="c" style="margin-top:6px">${new Date().toLocaleString("fr-FR")}</div>
  </body></html>`;
}

/** Imprime directement sur l'imprimante ESC/POS de l'appareil si elle est configurée, sinon via le navigateur. */
export async function printTickets(o: TicketOrder, kinds: TicketKind[], shopIn: TicketShop | string, width: TicketWidth = getTicketWidth(), fields?: Partial<KitchenFields>): Promise<boolean> {
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

function printBrowser(o: TicketOrder, kinds: TicketKind[], shop: TicketShop | string, width: TicketWidth, fields?: Partial<KitchenFields>): Promise<boolean> {
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
      { name: "Wok poulet", qty: 2, total: 23.8, details: ["Nouilles sautées", "+ Sauce piquante"] },
      { name: "California saumon", qty: 1, total: 6.5, details: ["Sans sésame"], allergens: ["poissons", "sesame", "soja"] },
    ],
    notes: "TICKET DE TEST", total: 30.3, payment_method: "on_site", source: "web",
  };
}
