import { createHmac, timingSafeEqual } from "crypto";

export function unsubToken(customerId: string) {
  return createHmac("sha256", process.env["CAMPAIGN_UNSUB_SECRET"]!).update(customerId).digest("hex").slice(0, 32);
}
export function checkUnsubToken(customerId: string, token: string) {
  const a = Buffer.from(unsubToken(customerId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function campaignHtml(o: { restaurant: string; body: string; ctaUrl?: string; ctaLabel?: string; color?: string }) {
  const color = /^#[0-9a-f]{6}$/i.test(o.color ?? "") ? o.color : "#c8102e";
  const body = esc(o.body).replace(/\n/g, "<br>");
  const cta = o.ctaUrl ? `<p style="text-align:center;margin:28px 0"><a href="${esc(o.ctaUrl)}" style="background:${color};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(o.ctaLabel || "Commander")}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:24px;color:${color};margin:0 0 16px">${esc(o.restaurant)}</h1>
<p style="font-size:15px;line-height:1.6">Bonjour {{params.name}},</p>
<p style="font-size:15px;line-height:1.6">${body}</p>${cta}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 12px">
<p style="font-size:11px;color:#888">Vous recevez cet email car vous avez accepté de recevoir les offres de ${esc(o.restaurant)}.
<a href="{{params.unsub}}" style="color:#888">Se désabonner</a></p></div></body></html>`;
}
