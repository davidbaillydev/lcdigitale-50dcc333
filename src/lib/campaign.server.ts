import { createHmac, timingSafeEqual } from "crypto";

export function unsubToken(customerId: string) {
  return createHmac("sha256", process.env["CAMPAIGN_UNSUB_SECRET"]!).update(customerId).digest("hex").slice(0, 32);
}
export function checkUnsubToken(customerId: string, token: string) {
  const a = Buffer.from(unsubToken(customerId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { campaignHtml } from "@/lib/email-templates";
