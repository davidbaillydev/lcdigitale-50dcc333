export type AlertOrder = { id: string; status: string; is_test?: boolean; source?: string; payment_status?: string; payment_method?: string };
export function isNewOrderAlert(event: string, order: AlertOrder, previousStatus?: string) {
  if (order.is_test || order.source === "pos" || !["new", "accepted", "pending_approval"].includes(order.status)) return false;
  return event === "INSERT" || (event === "UPDATE" && previousStatus === "awaiting_payment" && order.payment_status === "paid");
}