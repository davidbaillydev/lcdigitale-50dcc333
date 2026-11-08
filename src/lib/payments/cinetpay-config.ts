import { z } from "zod";

export const cinetpayCredentialsSchema = z.object({
  siteId: z.string().trim().regex(/^\d{1,30}$/, "Le Site ID CinetPay doit contenir des chiffres."),
  apiKey: z.string().trim().min(1, "Renseignez la clé API CinetPay.").max(300),
  secretKey: z.string().trim().min(1, "Renseignez la clé secrète CinetPay.").max(300),
  mode: z.enum(["sandbox", "production"]),
});

/** Only the documented success code with transaction data establishes API acceptance. */
export function cinetpayCheckAccepted(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as { code?: unknown; data?: unknown };
  return b.code === "00" && !!b.data && typeof b.data === "object" && !Array.isArray(b.data) && typeof (b.data as { status?: unknown }).status === "string";
}