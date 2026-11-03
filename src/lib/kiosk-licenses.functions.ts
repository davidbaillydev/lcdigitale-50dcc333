import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { annualEnd, annualTotal, billingSchema, KIOSK_ANNUAL_HT_CENTS, licenseSchema } from "./kiosk-licenses";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function agency(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Réservé à l’agence");
}
export const getKioskLicenses = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await agency(context.supabase, context.userId);
  const [rs, ls, bs] = await Promise.all([
    context.supabase.from("restaurants").select("id,name,slug,logo_url,config").order("name"),
    context.supabase.from("kiosk_licenses").select("*").order("kiosk_id"),
    context.supabase.from("kiosk_license_billing").select("*").order("created_at", { ascending: false }),
  ]);
  if (rs.error || ls.error || bs.error) throw new Error("Impossible de charger les licences");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { restaurants: rs.data ?? [], licenses: ls.data ?? [], billing: bs.data ?? [], today, annualHtCents: annualTotal(ls.data ?? [], today) };
});
export const saveKioskLicense = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => licenseSchema.parse(v)).handler(async ({ data, context }) => {
  await agency(context.supabase, context.userId);
  const { data: row, error } = await context.supabase.from("kiosk_licenses").upsert({ restaurant_id: data.restaurantId, kiosk_id: data.kioskId, label: data.label, status: data.status, starts_on: data.startsOn, ends_on: annualEnd(data.startsOn), notes: data.notes, updated_at: new Date().toISOString(), updated_by: context.userId }, { onConflict: "restaurant_id,kiosk_id" }).select("id").single();
  if (error || !row) throw new Error("Licence non enregistrée");
  return row;
});
export const prepareKioskBilling = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ licenseId: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
  await agency(context.supabase, context.userId);
  const { data: license, error: readError } = await context.supabase.from("kiosk_licenses").select("*").eq("id", data.licenseId).single();
  if (readError || !license) throw new Error("Licence introuvable");
  if (license.status !== "active") throw new Error("La licence doit être active");
  const { error } = await context.supabase.from("kiosk_license_billing").upsert({ license_id: license.id, starts_on: license.starts_on, ends_on: license.ends_on, amount_ht_cents: KIOSK_ANNUAL_HT_CENTS, updated_by: context.userId }, { onConflict: "license_id,starts_on,ends_on", ignoreDuplicates: true });
  if (error) throw new Error("Suivi de facturation non créé");
  return { ok: true };
});
export const saveKioskBilling = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => billingSchema.parse(v)).handler(async ({ data, context }) => {
  await agency(context.supabase, context.userId);
  const { data: row, error } = await context.supabase.from("kiosk_license_billing").update({ status: data.status, invoice_reference: data.invoiceReference, due_on: data.dueOn, paid_on: data.status === "paid" ? data.paidOn : null, notes: data.notes, updated_at: new Date().toISOString(), updated_by: context.userId }).eq("id", data.id).select("id").single();
  if (error || !row) throw new Error("Facturation non enregistrée");
  return row;
});