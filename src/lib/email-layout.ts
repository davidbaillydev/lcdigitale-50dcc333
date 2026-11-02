/** Mise en page commune des e-mails (commande, remboursement, campagne) aux couleurs du restaurant. */
export const escHtml = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailBrand = { name: string; color?: string | null; logoUrl?: string | null; address?: string | null; city?: string | null; phone?: string | null };

export const brandColor = (c?: string | null, fallback = "#1f2937") => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? c! : fallback);
/** Les logos stockés en data: sont bloqués par la plupart des messageries : on ne garde que les URL https. */
const safeLogo = (u?: string | null) => (/^https:\/\/[^\s"']+$/.test(u ?? "") ? u! : null);

export function emailButton(href: string, label: string, color: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px"><tr><td style="background:${color};border-radius:10px"><a href="${escHtml(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${escHtml(label)}</a></td></tr></table>`;
}

export function emailLayout(b: EmailBrand, o: { preheader?: string; title: string; body: string; footer?: string }) {
  const color = brandColor(b.color);
  const logo = safeLogo(b.logoUrl);
  const head = logo
    ? `<img src="${escHtml(logo)}" alt="${escHtml(b.name)}" height="56" style="height:56px;max-width:200px;border:0;display:block;margin:0 auto 10px">`
    : "";
  const contact = [b.address, b.city].filter(Boolean).map((s) => escHtml(String(s))).join(", ");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#1f2937">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escHtml(o.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${color};padding:24px;text-align:center">${head}<div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px">${escHtml(b.name)}</div></td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${escHtml(o.title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#374151">${o.body}</div></td></tr>
<tr><td style="padding:20px 28px 28px;border-top:1px solid #f0f0f0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
<b style="color:#374151">${escHtml(b.name)}</b>${contact ? `<br>${contact}` : ""}${b.phone ? `<br>${escHtml(b.phone)}` : ""}${o.footer ? `<br><br>${o.footer}` : ""}
</td></tr></table></td></tr></table></body></html>`;
}
