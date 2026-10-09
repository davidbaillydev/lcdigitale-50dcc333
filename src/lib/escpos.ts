// Encodeur ESC/POS : transforme une commande en octets pour imprimante thermique.
import { allergenLabel } from "./allergens";
import { isPaid, isPreorder, itemTitle, printingDefaults, type KitchenFields, type TicketKind, type TicketOrder, type TicketShop, type TicketWidth } from "./ticket";

const CP858: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a,
  "ï": 0x8b, "î": 0x8c, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "û": 0x96, "ù": 0x97, "Ö": 0x99, "Ü": 0x9a,
  "°": 0xf8, "€": 0xd5, "×": 0x9e,
};

class Enc {
  b: number[] = [];
  raw(...n: number[]) { this.b.push(...n); return this; }
  text(s: string) {
    for (const ch of s) {
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
const time = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const modeLabel = (m: string) => (m === "delivery" ? "LIVRAISON" : m === "dine_in" ? "SUR PLACE" : "A EMPORTER");
const payLabel = (p: string) => p === "online" ? "Payé en ligne" : p === "card_terminal" ? "CB au comptoir" : p === "counter" ? "Espèces/TR au comptoir" : "À encaisser";

function wrap(s: string, cols: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of s.split(/\s+/)) {
    if ((cur + " " + w).trim().length > cols) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
const lr = (l: string, r: string, cols: number) => { const sp = cols - l.length - r.length; return sp > 0 ? l + " ".repeat(sp) + r : `${l} ${r}`; };

export function ticketEscpos(o: TicketOrder, kind: TicketKind, width: TicketWidth, shop: TicketShop, fieldsIn?: Partial<KitchenFields>): Uint8Array {
  const cols = width === 80 ? 48 : 32;
  const f: KitchenFields = kind === "receipt"
    ? { allergens: true, options: true, notes: true, customer: true, contact: true, prices: true, paid: true, qc: false }
    : { ...printingDefaults().kitchen, ...(fieldsIn ?? {}) };
  const e = new Enc().raw(0x1b, 0x40, 0x1b, 0x74, 19);
  const hr = "-".repeat(cols);
  e.align(1).bold(true).size(1, 2).line(shop.name).size(1, 1).bold(false);
  if (f.contact) { if (shop.address) e.line(shop.address); if (shop.phone) e.line(shop.phone); }
  (isPreorder(kind, o) ? e.bold(true).line("BON DE PRE-COMMANDE").line("A REGLER EN CAISSE").bold(false) : e.line(kind === "kitchen" ? "TICKET CUISINE" : "TICKET CLIENT")).line(hr);
  e.bold(true).size(2, 2).line(`N° ${o.order_number}`).size(1, 2).line(modeLabel(o.mode) + (o.source === "kiosk" ? " - BORNE" : o.source === "phone" ? " - TEL IA" : "")).size(1, 1).bold(false);
  e.line(`Pour ${time(o.slot)}${o.created_at ? ` - reçue ${time(o.created_at)}` : ""}`);
  if (f.customer && o.customer_name) e.line(`${o.customer_name}${o.phone && o.phone !== "-" ? ` - ${o.phone}` : ""}`);
  if (o.mode === "delivery" && o.address) wrap(`${o.address}, ${o.city ?? ""}`, cols).forEach((l) => e.line(l));
  e.align(0).line(hr);
  for (const it of o.items) {
    e.bold(true);
    const name = `${it.qty}x ${itemTitle(it)}`;
    if (f.prices && it.total != null) e.line(lr(name, eur(it.total), cols)); else wrap(name, cols).forEach((l) => e.line(l));
    e.bold(false);
    if (f.options) for (const d of it.details ?? []) wrap(`  ${d}`, cols).forEach((l) => e.line(l));
    if (f.options) for (const op of it.selected_options ?? []) { const t = `  + ${op.name}`; if (f.prices && op.price) e.line(lr(t, `+${eur(op.price)}`, cols)); else wrap(t, cols).forEach((l) => e.line(l)); }
    if (f.allergens && it.allergens?.length) { e.bold(true); wrap(`  ! ALLERGENES : ${it.allergens.map((a) => allergenLabel(a).toUpperCase()).join(", ")}`, cols).forEach((l) => e.line(l)); e.bold(false); }
  }
  const allAlg = [...new Set(o.items.flatMap((i) => i.allergens ?? []))];
  if (f.allergens && kind === "kitchen" && allAlg.length) { e.line(hr).bold(true); wrap(`ALLERGENES COMMANDE : ${allAlg.map(allergenLabel).join(", ")}`, cols).forEach((l) => e.line(l)); e.bold(false); }
  if (f.notes && o.notes) { e.line(hr).bold(true); wrap(`! REMARQUE CLIENT : ${o.notes}`, cols).forEach((l) => e.line(l)); e.bold(false); }
  e.line(hr);
  if (f.prices && Number(o.delivery_fee) > 0) e.line(lr("Livraison", eur(o.delivery_fee), cols));
  if (f.prices && Number(o.service_fee) > 0) e.line(lr("Frais de service", eur(o.service_fee), cols));
  if (f.prices && Number(o.discount) > 0) e.line(lr(`Remise${o.promo_code ? ` ${o.promo_code}` : ""}`, `-${eur(o.discount)}`, cols));
  if (f.prices) e.bold(true).size(1, 2).line(lr("TOTAL", eur(o.total), cols)).size(1, 1).bold(false);
  if (f.prices) e.line(lr("dont TVA (10 % incluse)", eur(Number(o.total) - Number(o.total) / 1.1), cols));
  e.line(payLabel(o.payment_method));
  if (f.paid && !isPreorder(kind, o)) { const p = isPaid(o); e.line(hr).align(1).bold(true).size(1, 2).line(`[${p ? "X" : " "}] PAYE    [${p ? " " : "X"}] NON PAYE`).size(1, 1).bold(false).align(0); }
  if (f.qc && kind === "kitchen") { e.line(hr).bold(true).line("CONTROLE EMBALLAGE").bold(false).line("[ ] Articles conformes").line("[ ] Tous les articles").line("[ ] Couverts / sauces").line("").line("Visa : " + ".".repeat(Math.max(4, cols - 7))); }
  if (isPreorder(kind, o)) { e.line(hr).align(1).bold(true); wrap("Document non fiscal - A regler obligatoirement a la caisse du restaurant avant delivrance de la commande", cols).forEach((l) => e.line(l)); e.bold(false).line("Merci de votre commande !"); }
  else if (kind === "receipt") e.line(hr).align(1).line("PAYE - ticket non fiscal").line("Facture sur demande").line("Merci de votre commande !");
  e.align(1).line(new Date().toLocaleString("fr-FR"));
  e.raw(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00); // avance + coupe
  return new Uint8Array(e.b);
}
