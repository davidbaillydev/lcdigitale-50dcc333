type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const FALLBACK_ORIGIN = "https://lcdigitale.lovable.app";
const CONFIRMED = ["accepted", "preparing", "ready", "delivering", "done"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;

/** Email de confirmation (une seule fois par commande) avec lien direct vers la facture Factur-X. */
export async function sendOrderConfirmation(admin: Admin, orderId: string, origin?: string | null) {
  if (!process.env["BREVO_API_KEY"] || !process.env["LOVABLE_API_KEY"]) return { sent: false, reason: "brevo_missing" };
  const { data: o } = await admin.from("orders")
    .select("id, order_number, status, mode, slot, total, items, email, customer_name, confirmation_email_at, restaurants(slug, name, email, brand)")
    .eq("id", orderId).maybeSingle();
  if (!o || !o.email || o.confirmation_email_at || !CONFIRMED.includes(o.status)) return { sent: false };
  // Réservation atomique : évite un double envoi si deux écrans valident en même temps.
  const { data: claimed } = await admin.from("orders").update({ confirmation_email_at: new Date().toISOString() })
    .eq("id", o.id).is("confirmation_email_at", null).select("id");
  if (!claimed?.length) return { sent: false };

  const r = o.restaurants as unknown as { slug: string; name: string; email: string | null; brand: { accent?: string } | null };
  const color = /^#[0-9a-f]{6}$/i.test(r.brand?.accent ?? "") ? r.brand!.accent! : "#007af5";
  const base = /^https?:\/\/[^/]+$/.test(origin ?? "") ? origin! : FALLBACK_ORIGIN;
  const track = `${base}/${r.slug}/suivi/${o.id}`;
  const invoice = `${track}?facture=1`;
  const items = (o.items as { name: string; qty: number; total: number }[]) ?? [];
  const rows = items.map((i) => `<tr><td style="padding:4px 0">${i.qty} × ${esc(i.name)}</td><td style="text-align:right">${eur(i.total)}</td></tr>`).join("");
  const mode = o.mode === "delivery" ? "Livraison" : o.mode === "dine_in" ? "Sur place" : "À emporter";
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:22px;color:${color};margin:0 0 12px">${esc(r.name)}</h1>
<p style="font-size:15px">Bonjour ${esc(o.customer_name.split(" ")[0] ?? "")},</p>
<p style="font-size:15px">Votre commande <b>n° ${o.order_number}</b> est confirmée (${mode}).</p>
<table style="width:100%;font-size:14px;border-collapse:collapse">${rows}
<tr><td style="padding-top:8px;border-top:1px solid #eee"><b>Total TTC</b></td><td style="text-align:right;padding-top:8px;border-top:1px solid #eee"><b>${eur(Number(o.total))}</b></td></tr></table>
<p style="text-align:center;margin:28px 0 12px"><a href="${invoice}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Télécharger ma facture (PDF / Factur-X)</a></p>
<p style="text-align:center;font-size:13px"><a href="${track}" style="color:${color}">Suivre ma commande</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px">
<p style="font-size:11px;color:#888">Email envoyé suite à votre commande chez ${esc(r.name)}. Conservez ce lien : il donne accès à votre facture.</p>
</div></body></html>`;

  const res = await fetch(`${GATEWAY}/smtp/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": process.env["BREVO_API_KEY"]! },
    body: JSON.stringify({
      sender: { email: "contact@lcdigitale.fr", name: r.name },
      ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}),
      to: [{ email: o.email, name: o.customer_name }],
      subject: `${r.name} — commande n° ${o.order_number} confirmée`,
      htmlContent: html,
      headers: { "X-Mailin-Tag": "order-confirmation" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Brevo confirmation [${res.status}]: ${t}`);
    await admin.from("orders").update({ confirmation_email_at: null }).eq("id", o.id);
    return { sent: false, reason: `brevo_${res.status}` };
  }
  return { sent: true };
}

/** Email de confirmation de remboursement avec lien vers l'avoir (page de suivi). */
export async function sendRefundEmail(admin: Admin, orderId: string, amount: number, creditNote: string, origin?: string | null) {
  if (!process.env["BREVO_API_KEY"] || !process.env["LOVABLE_API_KEY"]) return { sent: false };
  const { data: o } = await admin.from("orders").select("id, order_number, email, customer_name, restaurants(slug, name, email)").eq("id", orderId).maybeSingle();
  if (!o?.email) return { sent: false };
  const r = o.restaurants as unknown as { slug: string; name: string; email: string | null };
  const base = /^https?:\/\/[^/]+$/.test(origin ?? "") ? origin! : FALLBACK_ORIGIN;
  const track = `${base}/${r.slug}/suivi/${o.id}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222"><div style="max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${esc(r.name)} — remboursement de votre commande n° ${o.order_number}</h1>
<p>Bonjour ${esc(o.customer_name)},</p>
<p>Nous avons remboursé <strong>${eur(amount)}</strong> sur le moyen de paiement utilisé lors de votre commande. Le crédit apparaît généralement sous 5 à 10 jours ouvrés selon votre banque.</p>
<p>Votre avoir <strong>${esc(creditNote)}</strong> est téléchargeable ici : <a href="${track}">${track}</a></p>
</div></body></html>`;
  const res = await fetch(`${GATEWAY}/smtp/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": process.env["BREVO_API_KEY"]! },
    body: JSON.stringify({
      sender: { email: "contact@lcdigitale.fr", name: r.name }, ...(r.email ? { replyTo: { email: r.email, name: r.name } } : {}),
      to: [{ email: o.email, name: o.customer_name }], subject: `${r.name} — remboursement commande n° ${o.order_number}`, htmlContent: html,
      headers: { "X-Mailin-Tag": "order-refund" },
    }),
  });
  if (!res.ok) console.error(`Brevo refund [${res.status}]: ${await res.text()}`);
  return { sent: res.ok };
}
