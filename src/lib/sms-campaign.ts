import { z } from "zod";

export const SMS_STOP = "Reply STOP to [STOP_CODE]";
export const smsDraftSchema = z.object({
  restaurantId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().trim().min(3).max(100),
  sender: z.string().trim().regex(/^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/, "Expéditeur : 1 à 11 lettres ou chiffres, dont une lettre."),
  body: z.string().trim().min(5).max(1000).refine((s) => !/\[STOP_CODE\]|\bSTOP\b/i.test(s), "La mention STOP est ajoutée automatiquement."),
  customerIds: z.array(z.string().uuid()).min(1).max(5000),
});

const dialCodes: Record<string, string> = { FR: "33", CM: "237", SN: "221", CI: "225", GA: "241", CG: "242", CD: "243", BJ: "229", BF: "226", ML: "223", NE: "227", TG: "228", TD: "235", CF: "236", GN: "224", GQ: "240", MA: "212", DZ: "213", TN: "216", BE: "32", CH: "41", LU: "352", CA: "1", US: "1" };
export function smsPhone(value: string | null, country = "FR") {
  let phone = (value ?? "").replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (!phone.startsWith("+")) {
    const code = dialCodes[country];
    if (!code || !/^\d+$/.test(phone)) return null;
    // Existing customer storage also keeps country-coded numbers without '+'.
    phone = phone.startsWith(code) && phone.length > 10 ? "+" + phone : "+" + code + phone.replace(/^0/, "");
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  if (phone.startsWith("+33") && !/^\+33[67]\d{8}$/.test(phone)) return null;
  return phone;
}

export type SmsCustomer = { id: string; name: string | null; phone: string | null; marketing_consent: boolean; consent_at: string | null };
export function eligibleSms(rows: SmsCustomer[], country: string, sentPhones: string[] = []) {
  const seen = new Set(sentPhones);
  return rows.flatMap((row) => {
    const phone = smsPhone(row.phone, country);
    if (!phone || !row.marketing_consent || !row.consent_at || !Number.isFinite(Date.parse(row.consent_at)) || seen.has(phone)) return [];
    seen.add(phone);
    return [{ ...row, phone }];
  });
}

const gsm = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const extension = new Set(Array.from("^{}\\[~]|€\f"));
export function smsMetrics(content: string) {
  const unicode = Array.from(content).some((c) => !gsm.has(c) && !extension.has(c));
  const units = unicode ? content.length : Array.from(content).reduce((n, c) => n + (extension.has(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return { characters: Array.from(content).length, units, unicode, segments: Math.max(1, Math.ceil(units / (units > single ? multi : single))) };
}
export const smsContent = (body: string) => `${body.trim()}\n${SMS_STOP}`;
export const smsPreview = (body: string) => smsContent(body).replace("[STOP_CODE]", "XXXXX");