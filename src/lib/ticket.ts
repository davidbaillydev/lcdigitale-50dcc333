// Impression de tickets thermiques (80 mm / 58 mm) via le dialogue d'impression du navigateur.
export type TicketWidth = 80 | 58;
export type TicketKind = "kitchen" | "receipt";
export type TicketOrder = {
  order_number: number; customer_name?: string | null; phone?: string | null; mode: string;
  address?: string | null; city?: string | null; slot: string; created_at?: string;
  items: { name: string; qty: number; total?: number; details?: string[] }[];
  notes?: string | null; total: number | string; delivery_fee?: number | string | null;
  payment_method: string; source?: string | null;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const eur = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;
const time = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const modeLabel = (m: string) => (m === "delivery" ? "LIVRAISON" : m === "dine_in" ? "SUR PLACE" : "À EMPORTER");
const payLabel = (p: string) =>
  p === "online" ? "Payé en ligne" : p === "card_terminal" ? "CB au comptoir" : p === "counter" ? "Espèces/TR au comptoir" : "À encaisser";

export function getTicketWidth(): TicketWidth {
  if (typeof window === "undefined") return 80;
  return localStorage.getItem("ticket-width") === "58" ? 58 : 80;
}
export function setTicketWidth(w: TicketWidth) { localStorage.setItem("ticket-width", String(w)); }

export function ticketHtml(o: TicketOrder, kind: TicketKind, width: TicketWidth, restaurant: string) {
  const big = width === 80 ? 15 : 12;
  const items = o.items.map((it) => `
    <div class="row"><b>${it.qty}× ${esc(it.name)}</b>${kind === "receipt" && it.total != null ? `<span>${eur(it.total)}</span>` : ""}</div>
    ${(it.details ?? []).map((d) => `<div class="det">${esc(d)}</div>`).join("")}`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${o.order_number}</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: ${width}mm; margin: 0; padding: 3mm; font: ${big}px/1.3 "Courier New", monospace; color: #000; background: #fff; }
    .c { text-align: center; } .xl { font-size: ${big * 2}px; font-weight: bold; } .l { font-size: ${big * 1.3}px; font-weight: bold; }
    .row { display: flex; justify-content: space-between; gap: 4px; margin-top: 4px; }
    .det { padding-left: 10px; font-size: ${big - 2}px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .note { border: 2px solid #000; padding: 4px; margin-top: 6px; font-weight: bold; }
  </style></head><body>
    <div class="c l">${esc(restaurant)}</div>
    <div class="c">${kind === "kitchen" ? "TICKET CUISINE" : "TICKET CLIENT"}</div>
    <hr><div class="c xl">N° ${o.order_number}</div>
    <div class="c l">${modeLabel(o.mode)}${o.source === "kiosk" ? " · BORNE" : ""}</div>
    <div class="c">Pour ${time(o.slot)}${o.created_at ? ` · reçue ${time(o.created_at)}` : ""}</div>
    ${o.customer_name ? `<div class="c">${esc(o.customer_name)}${o.phone && o.phone !== "-" ? ` · ${esc(o.phone)}` : ""}</div>` : ""}
    ${o.mode === "delivery" && o.address ? `<div class="c">${esc(o.address)}, ${esc(o.city)}</div>` : ""}
    <hr>${items}
    ${o.notes ? `<div class="note">⚠ ${esc(o.notes)}</div>` : ""}
    <hr>
    ${kind === "receipt" && Number(o.delivery_fee) > 0 ? `<div class="row"><span>Livraison</span><span>${eur(o.delivery_fee)}</span></div>` : ""}
    <div class="row l"><span>TOTAL</span><span>${eur(o.total)}</span></div>
    <div>${payLabel(o.payment_method)}</div>
    ${kind === "receipt" ? `<hr><div class="c">Merci de votre commande !</div>` : ""}
    <div class="c" style="margin-top:6px">${new Date().toLocaleString("fr-FR")}</div>
  </body></html>`;
}

/** Imprime un ou plusieurs tickets via une iframe cachée. */
export function printTickets(o: TicketOrder, kinds: TicketKind[], restaurant: string, width = getTicketWidth()) {
  const html = kinds.map((k) => ticketHtml(o, k, width, restaurant)).join("");
  const body = html.replace(/<\/body><\/html><!doctype html><html><head>[\s\S]*?<body>/g, '<div style="page-break-before:always"></div>');
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(body); d.close();
  setTimeout(() => {
    f.contentWindow?.focus(); f.contentWindow?.print();
    setTimeout(() => f.remove(), 60_000);
  }, 250);
}
