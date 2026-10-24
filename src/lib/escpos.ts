// Encodeur ESC/POS : transforme une commande en octets pour imprimante thermique.
import { allergenLabel } from "./allergens";
import { isPaid, isPreorder, itemTitle, modeLabel, payLabel, ticketFields, ticketOptions, ticketTiming, ticketTotals, type KitchenFields, type TicketKind, type TicketOrder, type TicketShop, type TicketWidth } from "./ticket";

const CP858: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a,
  "ï": 0x8b, "î": 0x8c, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "û": 0x96, "ù": 0x97, "Ö": 0x99, "Ü": 0x9a,
  "°": 0xf8, "€": 0xd5, "×": 0x9e,
};

class Enc {
  b: number[] = [];
  raw(...n: number[]) { this.b.push(...n); return this; }
  text(s: string) {
    const clean = s.replace(/[’‘‛`´]/g, "'").replace(/[“”]/g, '"').replace(/œ/g, "oe").replace(/Œ/g, "OE");
    for (const ch of clean) {
      const c = ch.charCodeAt(0);
      if (c < 128) this.b.push(c);
      else if (CP858[ch] != null) this.b.push(CP858[ch]);
      else { const n = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); this.b.push(n.charCodeAt(0) < 128 ? n.charCodeAt(0) : 0x3f); }
    }
    return this;
  }
  line(s = "") { return this.text(s).raw(0x0a); }
  align(a: 0 | 1 | 2) { return this.raw(0x1b, 0x61, a); }
  bold(on: boolean) { return this.raw(0x1b, 0x45, on ? 1 : 0); }
  size(w: 1 | 2, h: 1 | 2) { return this.raw(0x1d, 0x21, ((w - 1) << 4) | (h - 1)); }
}

const eur = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;

function wrap(s: string, cols: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of s.split(/\s+/)) {
    if (w.length > cols) {
      if (cur) { out.push(cur); cur = ""; }
      for (let i = 0; i < w.length; i += cols) out.push(w.slice(i, i + cols));
      continue;
    }
    if ((cur + " " + w).trim().length > cols) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
const lr = (l: string, r: string, cols: number) => { const sp = cols - l.length - r.length; return sp > 0 ? l + " ".repeat(sp) + r : `${l} ${r}`; };

export function ticketEscpos(o: TicketOrder, kind: TicketKind, width: TicketWidth, shop: TicketShop, fieldsIn?: Partial<KitchenFields>): Uint8Array {
  const cols = width === 80 ? 48 : 32;
  const f = ticketFields(kind, fieldsIn);
  const totals = ticketTotals(o);
  const e = new Enc().raw(0x1b, 0x40, 0x1b, 0x74, 19);
  const hr = "-".repeat(cols);
  e.align(1);
  (isPreorder(kind, o) ? e.bold(true).line("BON DE PRE-COMMANDE").line("A REGLER EN CAISSE").bold(false) : e.line(kind === "kitchen" ? "TICKET CUISINE" : "TICKET CLIENT")).line(hr);
  e.bold(true).size(2, 2).line(`N° ${o.order_number}`).size(1, 2);
  wrap(modeLabel(o.mode) + (o.source === "kiosk" ? " - BORNE" : o.source === "phone" ? " - TEL IA" : "") + (o.table_label ? ` - TABLE ${o.table_label}` : "") + (o.room_label ? ` - CHAMBRE ${o.room_label}` : ""), cols).forEach((l) => e.line(l));
  e.size(1, 1).bold(false).align(0);
  wrap(`Paiement : ${payLabel(o.payment_method)}`, cols).forEach((l) => e.line(l));
  wrap(ticketTiming(o), cols).forEach((l) => e.line(l));
  if (f.customer && (o.customer_name || o.phone || o.email)) {
    e.line(hr).bold(true).line("Informations clients").bold(false);
    if (o.customer_name) wrap(`Nom : ${o.customer_name}`, cols).forEach((l) => e.line(l));
    if (o.phone && o.phone !== "-") wrap(`Téléphone : ${o.phone}`, cols).forEach((l) => e.line(l));
    if (o.email) wrap(`Email : ${o.email}`, cols).forEach((l) => e.line(l));
  }
  if (o.mode === "delivery" && o.address) wrap(`${o.address}, ${o.city ?? ""}`, cols).forEach((l) => e.line(l));
  e.align(0).line(hr).bold(true).line("Articles").bold(false);
  for (const it of o.items) {
    wrap((it.category ?? "Carte").toUpperCase(), cols).forEach((l) => e.line(l));
    e.bold(true);
    const right = `${it.qty}x${f.prices && it.total != null ? ` ${eur(it.total)}` : ""}`;
    const names = wrap(itemTitle(it), Math.max(8, cols - right.length - 1));
    names.forEach((name, i) => e.line(i === 0 ? lr(name, right, cols) : name));
    e.bold(false);
    if (f.options) for (const d of ticketOptions(it)) wrap(d, cols - 2).forEach((l) => e.line(`  ${l}`));
    if (f.allergens && it.allergens?.length) { e.bold(true); wrap(`  ! ALLERGENES : ${it.allergens.map((a) => allergenLabel(a).toUpperCase()).join(", ")}`, cols).forEach((l) => e.line(l)); e.bold(false); }
  }
  const allAlg = [...new Set(o.items.flatMap((i) => i.allergens ?? []))];
  if (f.allergens && kind === "kitchen" && allAlg.length) { e.line(hr).bold(true); wrap(`ALLERGENES COMMANDE : ${allAlg.map(allergenLabel).join(", ")}`, cols).forEach((l) => e.line(l)); e.bold(false); }
  if (f.notes && o.notes) {
    const border = "=".repeat(cols);
    e.line(hr).bold(true).size(1, 2).line(border);
    wrap(`! REMARQUE CLIENT : ${o.notes}`, cols).forEach((l) => e.line(l));
    e.line(border).size(1, 1).bold(false);
  }
  e.line(hr);
  if (f.prices) e.line(lr("Sous total", eur(totals.subtotal), cols));
  if (f.prices && Number(o.delivery_fee) > 0) e.line(lr("Livraison", eur(o.delivery_fee), cols));
  if (f.prices && Number(o.service_fee) > 0) e.line(lr("Frais de service", eur(o.service_fee), cols));
  if (f.prices && Number(o.discount) > 0) e.line(lr(`Remise${o.promo_code ? ` ${o.promo_code}` : ""}`, `-${eur(o.discount)}`, cols));
  if (f.prices) e.line(lr("TVA (10 % incluse)", eur(totals.vat), cols));
  if (f.prices) e.bold(true).size(1, 2).line(lr("TOTAL", eur(totals.total), cols)).size(1, 1).bold(false);
  if (f.paid) { const p = isPaid(o); e.line(hr).align(1).bold(true).size(1, 2).line(`[${p ? "X" : " "}] PAYE    [${p ? " " : "X"}] IMPAYE`).size(1, 1).bold(false).align(0); }
  if (f.qc && kind === "kitchen") { e.line(hr).bold(true).line("CONTROLE EMBALLAGE").bold(false).line("[ ] Articles conformes").line("[ ] Tous les articles").line("[ ] Couverts / sauces").line("").line("Visa : " + ".".repeat(Math.max(4, cols - 7))); }
  if (isPreorder(kind, o)) { e.line(hr).align(1).bold(true); wrap("Document non fiscal - A regler obligatoirement a la caisse du restaurant avant delivrance de la commande", cols).forEach((l) => e.line(l)); e.bold(false).line("Merci de votre commande !"); }
  else if (kind === "receipt") e.line(hr).align(1).line("PAYE - ticket non fiscal").line("Facture sur demande").line("Merci de votre commande !");
  e.line(hr).align(1).bold(true).size(1, 2);
  wrap(shop.name, cols).forEach((l) => e.line(l));
  e.size(1, 1).bold(false);
  if (shop.address) wrap(shop.address, cols).forEach((l) => e.line(l));
  if (f.contact && shop.phone) wrap(shop.phone, cols).forEach((l) => e.line(l));
  e.line(new Date().toLocaleString("fr-FR"));
  e.raw(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00); // avance + coupe
  return new Uint8Array(e.b);
}
