import type { PrintTrigger, TicketKind } from "./ticket";

/** Arrival includes orders released after payment or staff approval. */
export function shouldAutoPrint(trigger: PrintTrigger, event: PrintTrigger, status: string) {
  return trigger === event && (trigger === "acceptance" ? status === "accepted" : status === "new" || status === "accepted");
}

/** One automatic attempt per order/kind on this kitchen screen, including concurrent events. */
export class KitchenAutoPrintClaims {
  private claimed = new Set<string>();
  take(orderId: string, kinds: TicketKind[]): TicketKind[] {
    return kinds.filter((kind) => {
      const key = `${orderId}:${kind}`;
      if (this.claimed.has(key)) return false;
      this.claimed.add(key);
      return true;
    });
  }
}