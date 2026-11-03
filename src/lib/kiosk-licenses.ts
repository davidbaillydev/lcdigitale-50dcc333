import { z } from "zod";

export const KIOSK_ANNUAL_HT_CENTS = 40000;
export const licenseSchema = z.object({
  restaurantId: z.string().uuid(), kioskId: z.string().trim().regex(/^[a-z0-9-]{1,20}$/),
  label: z.string().trim().max(40), status: z.enum(["active", "suspended", "ended"]),
  startsOn: z.string().date(), notes: z.string().trim().max(2000),
});
export const billingSchema = z.object({
  id: z.string().uuid(), status: z.enum(["to_invoice", "invoiced", "paid", "cancelled"]),
  invoiceReference: z.string().trim().max(120), dueOn: z.string().date().nullable(),
  paidOn: z.string().date().nullable(), notes: z.string().trim().max(2000),
}).superRefine((v, ctx) => {
  if ((v.status === "invoiced" || v.status === "paid") && !v.invoiceReference) ctx.addIssue({ code: "custom", message: "Référence de facture requise", path: ["invoiceReference"] });
  if (v.status === "paid" && !v.paidOn) ctx.addIssue({ code: "custom", message: "Date de règlement requise", path: ["paidOn"] });
});
export function annualEnd(start: string): string {
  const date = z.string().date().parse(start);
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
export function licenseActive(license: { status: string; starts_on: string; ends_on: string }, today: string): boolean {
  return license.status === "active" && license.starts_on <= today && today < license.ends_on;
}
export function annualTotal(licenses: { status: string; starts_on: string; ends_on: string }[], today: string): number {
  return licenses.filter((l) => licenseActive(l, today)).length * KIOSK_ANNUAL_HT_CENTS;
}