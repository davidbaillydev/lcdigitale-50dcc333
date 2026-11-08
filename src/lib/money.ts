import { z } from "zod";

export const currencySchema = z.enum(["EUR", "XOF", "XAF", "CDF", "USD"]);
export type Currency = z.infer<typeof currencySchema>;
export const countries = [
  { code: "FR", name: "France", currency: "EUR" },
  { code: "SN", name: "Sénégal", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "CM", name: "Cameroun", currency: "XAF" },
  { code: "GA", name: "Gabon", currency: "XAF" },
  { code: "CD", name: "RDC", currency: "CDF" },
  { code: "CG", name: "Congo", currency: "XAF" },
  { code: "BJ", name: "Bénin", currency: "XOF" },
  { code: "BF", name: "Burkina Faso", currency: "XOF" },
  { code: "TG", name: "Togo", currency: "XOF" },
  { code: "ML", name: "Mali", currency: "XOF" },
  { code: "NE", name: "Niger", currency: "XOF" },
  { code: "TD", name: "Tchad", currency: "XAF" },
  { code: "CF", name: "Centrafrique", currency: "XAF" },
  { code: "GQ", name: "Guinée équatoriale", currency: "XAF" },
] as const;
export const countrySchema = z.enum(["FR", "SN", "CI", "CM", "GA", "CD", "CG", "BJ", "BF", "TG", "ML", "NE", "TD", "CF", "GQ"]);
export const currencyLabels: Record<Currency, string> = { EUR: "Euro (€)", XOF: "Franc CFA Afrique de l’Ouest (FCFA)", XAF: "Franc CFA Afrique centrale (FCFA)", CDF: "Franc congolais (FC)", USD: "Dollar américain ($ US)" };
export function currencyOf(r?: { config?: { currency?: string } | null } | null): Currency {
  const result = currencySchema.safeParse(r?.config?.currency);
  return result.success ? result.data : "EUR";
}
export const moneyDecimals = (currency: Currency) => currency === "XOF" || currency === "XAF" ? 0 : 2;
export const currencyUnit = (currency: Currency) => currency === "EUR" ? "€" : currency === "XOF" || currency === "XAF" ? "FCFA" : currency === "CDF" ? "FC" : "$ US";
export function formatMoney(amount: number, currency: Currency = "EUR"): string {
  const digits = moneyDecimals(currency);
  const number = amount.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/[\u00a0\u202f]/g, " ");
  return `${number} ${currencyUnit(currency)}`;
}
export const mobileMoneyProviders = ["CinetPay", "Wave", "Airtel Money", "Orange Money", "MTN Mobile Money", "Moov Money"] as const;