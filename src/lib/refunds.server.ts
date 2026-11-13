// Cœur du remboursement (Stripe/Mollie + avoir), partagé par le gérant et l'expiration automatique des commandes manquées.
import type { Invoice, InvoiceData } from "./invoice";
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const providerOf = (ref: string | null) => (!ref ? null : ref.startsWith("pi_") ? "stripe" as const : ref.startsWith("mollie:") ? "mollie" as const : null);
export type RefundOrderRow = { id: string; is_test: boolean; order_number: number; restaurant_id: string; total: number; refunded_amount: number; payment_method: string; payment_status: string; payment_ref: string | null };
export async function performRefund(db: Admin, o: RefundOrderRow, opts: { amount?: number | undefined; itemIndexes?: number[] | undefined; reason: string; reasonLabel: string; key: string; userId: string | null }) {
    const key = opts.key;
    if (o.is_test) throw new Error("CB Test (Admin) : aucun paiement bancaire à rembourser.");

    const { data: done } = await db.from("order_refunds").select("credit_note_number, amount").eq("idempotency_key", key).maybeSingle();
    if (done) return { creditNote: done.credit_note_number, amount: Number(done.amount) };

    const provider = providerOf(o.payment_ref);
    if (o.payment_method !== "online" || !provider) throw new Error("Remboursement en 1 clic disponible uniquement pour les paiements en ligne Stripe ou Mollie.");
    if (!["paid", "partially_refunded"].includes(o.payment_status)) throw new Error("Cette commande n'est pas payée ou est déjà remboursée.");
    const remaining = r2(Number(o.total) - Number(o.refunded_amount));
    if (remaining <= 0) throw new Error("Commande déjà remboursée intégralement.");

    // La facture d'origine doit exister avant l'avoir (aucun argent ne bouge si elle ne peut pas être émise)
    const { issueForOrder } = await import("./invoice.server");
    const inv = await issueForOrder(db, o.id) as Invoice;
    const picked = opts.itemIndexes?.length ? opts.itemIndexes.map((i) => inv.data.lines[i]).filter((l): l is InvoiceData["lines"][number] => !!l && l.totalTTC > 0) : [];
    const amount = r2(picked.length ? picked.reduce((s, l) => s + l.totalTTC, 0) : opts.amount ?? remaining);
    if (amount <= 0) throw new Error("Montant invalide.");
    if (amount > remaining + 0.005) throw new Error(`Montant supérieur au reste remboursable (${remaining.toFixed(2).replace(".", ",")} €).`);

    // Remboursement chez le prestataire d'origine, avec clé d'idempotence
    const cents = Math.round(amount * 100);
    let providerRefundId = "";
    if (provider === "stripe") {
      const { stripeForRestaurant } = await import("./payments.functions");
      const s = await stripeForRestaurant(o.restaurant_id);
      if (!s) throw new Error("Stripe n'est plus configuré pour ce restaurant.");
      const res = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": key },
        body: new URLSearchParams({ payment_intent: o.payment_ref!, amount: String(cents), "metadata[order_id]": o.id, ...(opts.reason === "customer_request" ? { reason: "requested_by_customer" } : {}) }).toString(),
      });
      const body = await res.json().catch(() => null) as { id?: string; error?: { message?: string } } | null;
      if (!res.ok || !body?.id) { console.error("Stripe refund", res.status, body?.error?.message); throw new Error(`Stripe a refusé le remboursement : ${body?.error?.message ?? `erreur ${res.status}`}`); }
      providerRefundId = body.id;
    } else {
      const { mollieForRestaurant, mollieCall } = await import("./payments.functions");
      const m = await mollieForRestaurant(o.restaurant_id, false);
      if (!m) throw new Error("Mollie n'est plus configuré pour ce restaurant.");
      const res = await mollieCall(m.key, `/payments/${encodeURIComponent(o.payment_ref!.slice(7))}/refunds`, {
        amount: { currency: "EUR", value: amount.toFixed(2) }, description: `Commande n° ${o.order_number} — ${opts.reasonLabel}`, metadata: { order_id: o.id },
      }, key).catch((e: Error) => { throw new Error(`Mollie a refusé le remboursement : ${e.message.replace(/^Mollie : /, "")}`); }) as { id?: string };
      providerRefundId = res.id ?? "";
    }

    // Données figées de l'avoir
    const full = !picked.length && amount >= remaining - 0.005 && Number(o.refunded_amount) === 0;
    const lines = full ? inv.data.lines : picked.length ? picked : [{ name: `Remboursement partiel — commande n° ${o.order_number}`, qty: 1, unitTTC: amount, totalTTC: amount, vatRate: inv.data.vatRate }];
    const by = new Map<number, number>();
    for (const l of lines) by.set(l.vatRate ?? inv.data.vatRate, (by.get(l.vatRate ?? inv.data.vatRate) ?? 0) + l.totalTTC);
    const vatBreakdown = [...by.entries()].map(([rate, ttc]) => { const ht = r2(ttc / (1 + rate / 100)); return { rate, ht, vat: r2(ttc - ht), ttc: r2(ttc) }; });
    const ht = r2(vatBreakdown.reduce((s, v) => s + v.ht, 0));
    const credit: InvoiceData = {
      ...inv.data, lines, vatBreakdown, totalHT: ht, totalVAT: r2(amount - ht), totalTTC: amount, paid: true,
      creditNote: { of: inv.number, ofDate: inv.issued_at, reason: opts.reasonLabel, provider: provider === "stripe" ? "Stripe" : "Mollie" },
    };
    const { data: row, error } = await db.rpc("record_refund", {
      _order_id: o.id, _restaurant_id: o.restaurant_id, _amount: amount, _reason: opts.reason, _provider: provider,
      _provider_refund_id: providerRefundId, _key: key, _data: credit as never, _user: opts.userId as string,
    });
    if (error || !row) { console.error("record_refund", error); throw new Error(`Remboursement effectué chez ${provider === "stripe" ? "Stripe" : "Mollie"} (réf. ${providerRefundId}) mais l'avoir n'a pas pu être enregistré : contactez l'agence.`); }
    const rec = row as unknown as { credit_note_number: string };
    const { sendRefundEmail } = await import("./order-email.server");
    await sendRefundEmail(db, o.id, amount, rec.credit_note_number).catch((e) => console.error(e));
    return { creditNote: rec.credit_note_number, amount };
    return { creditNote: rec.credit_note_number, amount };
}
