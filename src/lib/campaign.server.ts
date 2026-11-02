import { createHmac, timingSafeEqual } from "crypto";
import { emailLayout, emailButton, escHtml, brandColor, type EmailBrand } from "@/lib/email-layout";

export function unsubToken(customerId: string) {
  return createHmac("sha256", process.env["CAMPAIGN_UNSUB_SECRET"]!).update(customerId).digest("hex").slice(0, 32);
}
export function checkUnsubToken(customerId: string, token: string) {
  const a = Buffer.from(unsubToken(customerId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function campaignHtml(o: { restaurant: string; body: string; ctaUrl?: string | undefined; ctaLabel?: string | undefined; color?: string | undefined; subject?: string | undefined; brand?: Omit<EmailBrand, "name" | "color"> | undefined }) {
  const color = brandColor(o.color, "#c8102e");
  const body = escHtml(o.body).replace(/\n/g, "<br>");
  return emailLayout({ name: o.restaurant, color, ...(o.brand ?? {}) }, {
    preheader: o.subject,
    title: o.subject || `Des nouvelles de ${o.restaurant}`,
    body: `<p style="margin:0 0 12px">Bonjour {{params.name}},</p><p style="margin:0 0 12px">${body}</p>${o.ctaUrl ? emailButton(o.ctaUrl, o.ctaLabel || "Commander", color) : ""}`,
    footer: `Vous recevez cet e-mail car vous avez accepté les offres de ${escHtml(o.restaurant)}.<br><a href="{{params.unsub}}" style="color:#6b7280">Se désabonner</a>`,
  });
}
