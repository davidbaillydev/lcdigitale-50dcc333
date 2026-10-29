export type DeliveryStep = "en_route" | "delivered";

/** Keep the order ready/visible during the journey; close it only on delivery. */
export function deliveryStatusPatch(step: DeliveryStep, at = new Date().toISOString()) {
  return { status: step === "delivered" ? "done" : "ready", courier_status: step, courier_at: at };
}

export function customerOrderStage(order: { mode: string; status: string; courier_status?: string | null }) {
  if (order.mode === "delivery" && order.courier_status === "en_route" && order.status === "ready") return "en_route";
  return order.status;
}

export const hasPendingKitchenOrders = (orders: { status: string }[]) =>
  orders.some((o) => o.status === "new" || o.status === "pending_approval");

/** Stop reminders immediately when acceptance is confirmed or sound is disabled. */
export function startKitchenReminder(enabled: boolean, orders: { status: string }[], ring: () => void) {
  if (!enabled || !hasPendingKitchenOrders(orders)) return () => {};
  const timer = setInterval(ring, 10_000);
  return () => clearInterval(timer);
}