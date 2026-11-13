// Commandes du site non acceptées en 4 minutes : passage en « manquée », remboursement automatique si payée en ligne, alertes client + restaurant.
import { issueAccessToken } from "./customer-access-core.server";
import { formatMoney, currencySchema } from "./money";
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const BASE = "https://restaurant.lcdigitale.fr";

async function mail(to: string, name: string, senderName: string, subject: string, html: string) {
  if (!process.env["BREVO_API_KEY"] || !process.env["LOVABLE_API_KEY"]) return;
  const res = await fetch(`${GATEWAY}/smtp/email`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": process.env["BREVO_API_KEY"] }, body: JSON.stringify({ sender: { email: "contact@lcdigitale.fr", name: senderName }, to: [{ email: to, name }], subject, htmlContent: html, headers: { "X-Mailin-Tag": "order-missed" } }) });
  if (!res.ok) console.error(`Brevo order-missed [${res.status}]: ${await res.text()}`);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Expire une commande précise (si son délai est dépassé) ou toutes les commandes échues. Idempotent. */
export async function expireMissedOrders(db: Admin, orderId?: string) {
  let q = db.from("orders").select("id").eq("status", "new").is("missed_at", null).not("accept_deadline", "is", null).lt("accept_deadline", new Date().toISOString()).limit(50);
  if (orderId) q = q.eq("id", orderId);
  const { data: due } = await q;
  let count = 0;
  const cols = "id, order_number, restaurant_id, total, currency, refunded_amount, payment_method, payment_status, payment_ref, is_test, email, customer_name, restaurants(slug, name, email)";
  for (const { id } of due ?? []) {
    // Empreinte CB : relâchée immédiatement, aucun débit (releaseOrder passe la commande en annulée).
    let released = false;
    try { const { releaseOrder } = await import("./payments/preauth"); released = await releaseOrder(id); } catch (e) { console.error("missed release", id, e); }
    // Réservation atomique : une seule exécution passe la commande en manquée.
    const claim = db.from("orders").update({ status: "cancelled", missed_at: new Date().toISOString() }).eq("id", id).is("missed_at", null);
    const { data: rows } = await (released ? claim.eq("status", "cancelled") : claim.eq("status", "new")).select(cols);
    const o = rows?.[0]; if (!o) continue;
    count++;
    const r = o.restaurants as unknown as { slug: string; name: string; email: string | null };
    let refunded = false;
    if (o.payment_method === "online" && o.payment_status === "paid") {
      try {
        const { performRefund } = await import("./refunds.server");
        await performRefund(db, o, { reason: "kitchen_delay", reasonLabel: "Commande non acceptée par le restaurant dans les 4 minutes", key: `refund_${o.id}_missed`, userId: null });
        refunded = true;
      } catch (e) { console.error("missed refund", o.id, e); }
    }
    const money = formatMoney(Number(o.total), currencySchema.parse(o.currency ?? "EUR"));
    const link = `${BASE}/${r.slug}/suivi/${o.id}?access=${encodeURIComponent(issueAccessToken("order", o.id))}`;
    const payLine = o.payment_method !== "online" ? "Aucun paiement n'a été encaissé." : released ? "L'empreinte bancaire est annulée : aucun montant ne sera débité." : refunded ? `Votre paiement de ${money} est remboursé automatiquement (délai bancaire de quelques jours).` : "Le remboursement de votre paiement est en cours de traitement par le restaurant.";
    const tasks: Promise<unknown>[] = [];
    if (o.email) tasks.push(mail(o.email, o.customer_name, r.name, `${r.name} — commande n° ${o.order_number} non acceptée`, `<p>Bonjour,</p><p>Le restaurant <strong>${esc(r.name)}</strong> n'a pas pu accepter votre commande n° ${o.order_number} dans les 4 minutes. Elle est annulée.</p><p>${payLine}</p><p><a href="${link}">Voir ma commande</a></p>`));
    if (r.email) tasks.push(mail(r.email, r.name, "LC Digitale", `Commande n° ${o.order_number} manquée`, `<p>La commande n° ${o.order_number} (${money}) n'a pas été acceptée dans les 4 minutes : elle a été annulée automatiquement et le client a été prévenu.${o.payment_method === "online" ? (released ? " L'empreinte bancaire a été relâchée sans débit." : refunded ? " Le paiement en ligne a été remboursé." : " Attention : le remboursement automatique a échoué, à faire depuis l'espace restaurant.") : ""}</p>`));
    tasks.push(import("./push.server").then(({ notifySubscribers }) => notifySubscribers(db, { order_id: o.id, audience: "customer" }, { title: r.name, body: `Commande n° ${o.order_number} non acceptée à temps : annulée.`, url: `/${r.slug}/suivi/${o.id}` })));
    await Promise.allSettled(tasks);
  }
  return count;
}
