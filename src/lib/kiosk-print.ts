// Ticket client imprimé par la borne dès que la commande est validée, sur l'imprimante propre à la borne.
import type { TicketOrder, TicketShop } from "./ticket";

/** Imprime le ticket client si une imprimante borne est configurée sur cet appareil ; jamais de fenêtre d'impression. */
export async function printKioskReceipt(order: TicketOrder, shop: TicketShop, paid: boolean): Promise<boolean> {
  const { getPrinter, sendToPrinter } = await import("./printer");
  const p = getPrinter("kiosk");
  if (!p) return false;
  const { ticketEscpos } = await import("./escpos");
  const o: TicketOrder = paid ? { ...order, payment_status: "paid" } : order;
  try { await sendToPrinter(p, ticketEscpos(o, "receipt", p.width ?? 80, shop)); return true; }
  catch (e) { console.warn("Impression borne échouée", e); return false; }
}
