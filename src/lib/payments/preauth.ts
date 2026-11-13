// Pré-autorisation CB Mollie (captureMode manual) : empreinte à la commande, capture à l'acceptation, libération sinon.
import { admin } from "./shared";
import { mollieCall, mollieForRestaurant, mollieOauthTestTokens } from "./mollie";

type O = { id: string; restaurant_id: string; status: string; total: number | string; payment_ref: string | null };
const pid = (ref: string | null) => (ref?.startsWith("mollie:") ? ref.slice(7) : null);

/** Empreinte confirmée : la commande part en cuisine (statut new), sans débit. */
export async function markAuthorized(o: O) {
  const db = await admin();
  const { data } = await db.from("orders").update({ payment_status: "authorized", status: o.status === "awaiting_payment" ? "new" : o.status, updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "pending").select("id");
  if (!data?.length) return;
  const { data: r } = await db.from("restaurants").select("config").eq("id", o.restaurant_id).maybeSingle();
  if ((r?.config as { autoAccept?: boolean } | null)?.autoAccept) { await captureOrder(o.id).catch((e) => console.error("auto capture", e)); return; }
  const { notifyNewOrder } = await import("../order-email.server");
  await notifyNewOrder(db, o.id).catch((e) => console.error(e));
}

/** Capture (débit réel) puis acceptation atomique. Lève une erreur si le prestataire refuse. */
export async function captureOrder(orderId: string, slot?: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, status, total, payment_status, payment_ref, accept_deadline, missed_at").eq("id", orderId).maybeSingle();
  if (!o) throw new Error("Commande introuvable");
  if (o.payment_status !== "authorized") throw new Error("Aucune pré-autorisation à capturer.");
  if (o.status !== "new" || o.missed_at || (o.accept_deadline && Date.now() > new Date(o.accept_deadline).getTime() + 5000)) throw new Error("Délai d'acceptation dépassé : l'empreinte bancaire va être relâchée.");
  const id = pid(o.payment_ref); if (!id) throw new Error("Paiement non reconnu");
  const m = await mollieForRestaurant(o.restaurant_id, false); if (!m) throw new Error("Mollie n'est plus configuré pour ce restaurant.");
  await mollieCall(m.key, `/payments/${encodeURIComponent(id)}/captures`, { description: "Commande acceptée" }, `capture_${o.id}`)
    .catch((e: Error) => { throw new Error(`Capture refusée par la banque : ${e.message.replace(/^Mollie : /, "")}`); });
  await db.from("orders").update({ payment_status: "paid", status: "accepted", ...(slot ? { slot } : {}), updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "authorized");
  const { sendOrderConfirmation } = await import("../order-email.server");
  await sendOrderConfirmation(db, o.id).catch((e) => console.error(e));
  const { syncOrderToPos } = await import("../pos.server");
  await syncOrderToPos(o.id).catch((e) => console.error(e));
}

/** Annule l'empreinte (fonds relâchés, aucun débit) et passe la commande en annulée. Idempotent. */
export async function releaseOrder(orderId: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, payment_status, payment_ref").eq("id", orderId).maybeSingle();
  if (!o || o.payment_status !== "authorized") return false;
  const id = pid(o.payment_ref); const m = id ? await mollieForRestaurant(o.restaurant_id, false) : null;
  if (!id || !m) throw new Error("Mollie indisponible : empreinte non relâchée.");
  const test = mollieOauthTestTokens.has(m.key) ? "?testmode=true" : "";
  const res = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(id)}${test}`, { method: "DELETE", headers: { Authorization: `Bearer ${m.key}` } });
  if (!res.ok && res.status !== 422) { const t = await res.text(); console.error("mollie release", res.status, t); throw new Error(`Mollie a refusé la libération [${res.status}]`); }
  await db.from("orders").update({ payment_status: "released", status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "authorized");
  return true;
}

/** Webhook sur une commande déjà pré-autorisée : capture confirmée ou empreinte expirée chez Mollie. */
export async function syncAuthorizedMollie(o: O, paymentId: string): Promise<"paid" | "failed" | "pending"> {
  const m = await mollieForRestaurant(o.restaurant_id, false); if (!m) return "paid";
  const p = await mollieCall(m.key, `/payments/${encodeURIComponent(paymentId)}`) as { status?: string };
  const db = await admin();
  if (p.status === "canceled" || p.status === "expired" || p.status === "failed") {
    await db.from("orders").update({ payment_status: "released", status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "authorized");
    return "failed";
  }
  return "paid";
}
