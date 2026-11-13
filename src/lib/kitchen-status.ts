export type DeliveryStep = "en_route" | "delivered";

/** Keep the order ready/visible during the journey; close it only on delivery. */
export function deliveryStatusPatch(step: DeliveryStep, at = new Date().toISOString()) {
  return { status: step === "delivered" ? "done" : "ready", courier_status: step, courier_at: at };
}

export function customerOrderStage(order: { mode: string; status: string; courier_status?: string | null }) {
  if (order.mode === "delivery" && order.courier_status === "en_route" && order.status === "ready") return "en_route";
  return order.status;
}

/** Keep payment and active-order checks, but stop timers once tracking is final. */
export function orderTrackingInterval(status: string | undefined): number | false {
  if (status === "done" || status === "cancelled") return false;
  return status === "awaiting_payment" ? 3_000 : status === "new" ? 5_000 : 15_000;
}

export const hasPendingKitchenOrders = (orders: { status: string }[]) =>
  orders.some((o) => o.status === "new" || o.status === "pending_approval");

/** Stop reminders immediately when acceptance is confirmed or sound is disabled. */
export function startKitchenReminder(enabled: boolean, orders: { status: string }[], ring: () => void, intervalMs = 5_000) {
  if (!enabled || !hasPendingKitchenOrders(orders)) return () => {};
  const timer = setInterval(ring, Math.max(3_000, intervalMs));
  return () => clearInterval(timer);
}
/** « Perte » : commande à emporter non récupérée, jamais réglée en ligne ni encaissée. */
export const canMarkNoShow = (o: { mode: string; status: string; payment_method: string; payment_status?: string | null; is_test?: boolean | null }) =>
  o.mode === "pickup" && (o.status === "accepted" || o.status === "ready") && o.payment_method !== "online" && o.payment_status !== "paid" && !o.is_test;
