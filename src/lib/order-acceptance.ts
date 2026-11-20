export const ACCEPTANCE_SECONDS = 300;
/** UI and payment guards must not treat stale non-delivery deadlines as blocking. */
export function hasAcceptanceDeadline(order: { mode: string; accept_deadline?: string | null }) {
  return order.mode === "delivery" && !!order.accept_deadline;
}