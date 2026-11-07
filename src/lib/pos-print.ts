import { POS_TENDER_LABELS, type ZReport } from "./pos-register";
import { getTicketWidth, printTickets, type TicketOrder, type TicketShop, type TicketWidth } from "./ticket";
import { cashDrawerPulse, reportEscpos, ticketEscpos } from "./escpos";
import { getPrinter, sendToPrinter } from "./printer";

/** Serialize all register jobs so rapid taps cannot interleave thermal bytes. */
let queue: Promise<unknown> = Promise.resolve();
function queued<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}

export function receiptOpensDrawer(order: TicketOrder, reprint: boolean): boolean {
  return !reprint && order.source === "pos" && order.payment_status === "paid" && (order.pos_payments?.some((p) => p.method === "cash") ?? order.pos_tender?.method === "cash");
}

export function printPosReceipt(order: TicketOrder, shop: TicketShop, reprint = false): Promise<boolean> {
  return queued(async () => {
    const printer = getPrinter();
    const width = printer?.width ?? getTicketWidth();
    if (!printer) return printTickets(order, ["receipt"], shop, width);
    const receipt = ticketEscpos(order, "receipt", width, shop);
    const pulse = receiptOpensDrawer(order, reprint) ? cashDrawerPulse() : new Uint8Array();
    const data = new Uint8Array(receipt.length + pulse.length);
    data.set(receipt); data.set(pulse, receipt.length);
    try { await sendToPrinter(printer, data); return true; }
    catch { return false; }
  });
}

export type PosReportTicket = { kind: "X" | "Z"; number?: number | undefined; openedAt: string; at: string; report: ZReport };
export function posReportLines(shop: TicketShop, ticket: PosReportTicket): string[] {
  const r = ticket.report;
  const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  const date = (d: string) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  return [shop.name, ...(shop.address ? [shop.address] : []), `TICKET ${ticket.kind}${ticket.number != null ? ` N° ${ticket.number}` : " — INTERMÉDIAIRE"}`, `Ouverture : ${date(ticket.openedAt)}`, `${ticket.kind === "Z" ? "Clôture" : "Lecture"} : ${date(ticket.at)}`, "--------------------------------", `Ventes : ${r.orders} · Annulées : ${r.cancelled}`, `Total TTC : ${eur(r.total)}`, ...Object.entries(r.byMethod).map(([m, v]) => `${POS_TENDER_LABELS[m as keyof typeof POS_TENDER_LABELS]} : ${v.count} / ${eur(v.amount)}`), `Remises : ${eur(r.discountTotal ?? 0)}`, `Annulations : ${eur(r.cancelledAmount ?? 0)}`, `Entrées espèces : ${eur(r.cashIn ?? 0)}`, `Sorties espèces : ${eur(r.cashOut ?? 0)}`, ...(r.vat ?? []).map((v) => `TVA ${v.rate}% : HT ${eur(v.ht)} / TVA ${eur(v.vat)} / TTC ${eur(v.ttc)}`), ...(r.events ?? []).map((e) => `${date(e.at)} ${e.kind} ${eur(e.amount)} : ${e.reason}`), `Fond de caisse : ${eur(r.openingFloat)}`, `Espèces attendues : ${eur(r.expectedCash)}`, ...(r.countedCash == null ? ["Caisse toujours ouverte"] : [`Espèces comptées : ${eur(r.countedCash)}`, `Écart espèces : ${eur(r.cashDifference ?? 0)}`]), "--------------------------------", "Caisse non certifiée NF525"];
}

export function posReportHtml(lines: string[], width: TicketWidth): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  return `<!doctype html><html><head><title>Rapport caisse</title><style>@page{size:${width}mm auto;margin:0}body{width:${width}mm;box-sizing:border-box;padding:3mm;margin:0;font:14px monospace;overflow-wrap:anywhere}p{margin:5px 0}</style></head><body>${lines.map((l) => `<p>${escape(l)}</p>`).join("")}</body></html>`;
}

export function printPosReport(shop: TicketShop, ticket: PosReportTicket): Promise<boolean> {
  return queued(async () => {
    const printer = getPrinter();
    const width = printer?.width ?? getTicketWidth();
    const lines = posReportLines(shop, ticket);
    if (printer) {
      try { await sendToPrinter(printer, reportEscpos(lines, width)); return true; } catch { return false; }
    }
    return new Promise<boolean>((resolve) => {
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(frame);
      const d = frame.contentDocument; const w = frame.contentWindow;
      if (!d || !w) { frame.remove(); resolve(false); return; }
      d.open(); d.write(posReportHtml(lines, width)); d.close();
      setTimeout(() => { try { w.focus(); w.print(); resolve(true); } catch { resolve(false); } setTimeout(() => frame.remove(), 60000); }, 250);
    });
  });
}