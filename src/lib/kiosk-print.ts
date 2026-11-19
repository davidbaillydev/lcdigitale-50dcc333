// Ticket client imprimé par la borne uniquement à la demande du client, sur l'imprimante propre à la borne.
import type { TicketOrder, TicketShop, KioskTicketContext } from "./ticket";

/** Imprime le ticket client si une imprimante borne est configurée sur cet appareil ; jamais de fenêtre d'impression. */
export async function printKioskReceipt(order: TicketOrder, shop: TicketShop, paid: boolean, kiosk?: KioskTicketContext): Promise<boolean> {
  const { getPrinter, sendToPrinter } = await import("./printer");
  const p = getPrinter("kiosk");
  if (!p) return false;
  const { ticketEscpos } = await import("./escpos");
  const o: TicketOrder = paid ? { ...order, payment_status: "paid" } : order;
  try { await sendToPrinter(p, ticketEscpos(o, "receipt", p.width ?? 80, shop, undefined, kiosk), true); return true; }
  catch (e) { console.warn("Impression borne échouée", e); return false; }
}
