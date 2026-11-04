import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthlyCommissions, monthRange, parisDay, zohoReference, lastDayOfMonth, monthLabel, INVOICE_ITEM_NAME, invoiceItemDescription, invoiceNotes, type GainOrderRow } from "@/lib/agency-gains";
import { zoho, zohoInvoiceUrl } from "@/lib/zoho-books.server";

const input = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

export type ZohoInvoiceStatus = { restaurantId: string; invoiceId: string; invoiceNumber: string; status: string; total: number; url: string };
type ZInvoice = { invoice_id: string; invoice_number: string; status: string; total: number; reference_number: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadMonth(supabase: any, month: string) {
  const { from, to } = monthRange(month);
  const { data: rs, error: re } = await supabase.from("restaurants").select("id, name, email, legal").order("name");
  if (re) throw new Error("Impossible de charger les restaurants.");
  const rows: GainOrderRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: orders, error } = await supabase.from("orders")
      .select("id, order_number, restaurant_id, service_fee, total, status, created_at, payment_status, payment_method, payment_ref, platform_fee, refunded_amount, delivery_fee, discount, source, mode")
      .eq("is_test", false).gte("created_at", new Date(Date.parse(`${from}T00:00:00.000Z`) - 86_400_000).toISOString()).lte("created_at", `${to}T23:59:59.999Z`).order("id").range(offset, offset + 999);
    if (error) throw new Error("Impossible de charger les commandes.");
    rows.push(...(orders ?? []));
    if ((orders ?? []).length < 1000) break;
  }
  // Jours Paris : bornes élargies côté requête, filtre précis ici.
  const inMonth = rows.filter((r) => parisDay(r.created_at).startsWith(month));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (rs ?? []) as any[];
  const monthly = monthlyCommissions(inMonth, list.map((r) => ({ restaurantId: r.id, name: r.name, legal: r.legal ?? {} })));
  const emails = Object.fromEntries(list.map((r) => [r.id, (r.legal?.email || r.email || "") as string]));
  return monthly.map((m) => ({ ...m, email: emails[m.restaurantId] ?? "" }));
}

async function existingInvoices(month: string) {
  const prefix = `COM-${month.replace("-", "")}-`;
  const out: ZInvoice[] = [];
  for (let page = 1; page < 20; page++) {
    const r = await zoho<{ invoices: ZInvoice[]; page_context?: { has_more_page?: boolean } }>("/invoices", { query: { reference_number_startswith: prefix, per_page: "200", page: String(page) } });
    out.push(...r.invoices.filter((i) => i.reference_number?.startsWith(prefix)));
    if (!r.page_context?.has_more_page) break;
  }
  return out;
}

function statusFor(month: string, restaurantIds: string[], invoices: ZInvoice[]): ZohoInvoiceStatus[] {
  return restaurantIds.flatMap((id) => {
    const inv = invoices.find((i) => i.reference_number === zohoReference(month, id));
    return inv ? [{ restaurantId: id, invoiceId: inv.invoice_id, invoiceNumber: inv.invoice_number, status: inv.status, total: Number(inv.total ?? 0), url: zohoInvoiceUrl(inv.invoice_id) }] : [];
  });
}

export const getZohoInvoiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    try {
      const rows = await loadMonth(context.supabase, data.month);
      return { statuses: statusFor(data.month, rows.map((r) => r.restaurantId), await existingInvoices(data.month)), error: null as string | null };
    } catch (e) {
      return { statuses: [] as ZohoInvoiceStatus[], error: e instanceof Error ? e.message : "Zoho indisponible" };
    }
  });

type ZContact = { contact_id: string; contact_name: string; company_name?: string; email?: string };
async function findOrCreateContact(r: { name: string; company: string; email: string; siret: string; vat: string; seat: string }) {
  const searches: Record<string, string>[] = [];
  if (r.company) searches.push({ contact_name: r.company }, { company_name: r.company });
  searches.push({ contact_name: r.name });
  if (r.email) searches.push({ email: r.email });
  for (const q of searches) {
    const res = await zoho<{ contacts: ZContact[] }>("/contacts", { query: { ...q, contact_type: "customer" } });
    if (res.contacts?.[0]) return { id: res.contacts[0].contact_id, created: false };
  }
  const notes = [r.siret && `SIRET : ${r.siret}`, r.vat && `TVA : ${r.vat}`, `Restaurant : ${r.name}`].filter(Boolean).join("\n");
  const created = await zoho<{ contact: ZContact }>("/contacts", { method: "POST", body: {
    contact_name: r.company || r.name, company_name: r.company || r.name, contact_type: "customer", notes,
    ...(r.seat ? { billing_address: { address: r.seat } } : {}),
    ...(r.email ? { contact_persons: [{ email: r.email, is_primary_contact: true }] } : {}),
  } });
  return { id: created.contact.contact_id, created: true };
}

export const createZohoDraftInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const rows = await loadMonth(context.supabase, data.month);
    const existing = await existingInvoices(data.month);
    const report = { created: 0, skipped: 0, contactsCreated: 0, errors: [] as { name: string; message: string }[] };
    for (const r of rows) {
      const reference = zohoReference(data.month, r.restaurantId);
      if (existing.some((i) => i.reference_number === reference)) { report.skipped++; continue; }
      try {
        const contact = await findOrCreateContact(r);
        if (contact.created) report.contactsCreated++;
        const res = await zoho<{ invoice: ZInvoice }>("/invoices", { method: "POST", body: {
          customer_id: contact.id, date: lastDayOfMonth(data.month), reference_number: reference,
          line_items: [{ name: INVOICE_ITEM_NAME, description: invoiceItemDescription(data.month, r.name, r.orders), rate: r.commission, quantity: 1 }],
          notes: invoiceNotes(r.siret),

        } });
        existing.push(res.invoice);
        report.created++;
      } catch (e) {
        report.errors.push({ name: r.name, message: e instanceof Error ? e.message : "Erreur inconnue" });
      }
    }
    return { ...report, statuses: statusFor(data.month, rows.map((x) => x.restaurantId), existing) };
  });
