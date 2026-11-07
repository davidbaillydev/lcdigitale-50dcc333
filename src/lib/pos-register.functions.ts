import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RESTAURANT_COLUMNS, type Restaurant, assertItemAvailable } from "./shop";
import { posEnabled, posPaymentMethod, validatePosPayments, directDiscount, type PosPayment, type PosDiscount, type PosTender } from "./pos-register";
import { vatBreakdown, defaultVatRate } from "./ticket-vat";
import type { TicketOrder } from "./ticket";
import type { ZReport } from "./pos-register";

export type PosReceipt = TicketOrder & { id: string; pos_receipt_number: number; pos_tender: PosTender; pos_payments: PosPayment[] | null; pos_discount: PosDiscount | null; status: string };
export const posLinesSchema = z.array(z.object({ itemId: z.string().max(80), qty: z.number().int().min(1).max(50), sel: z.record(z.string(), z.array(z.string().max(80)).max(30)) })).min(1).max(60);
export const posDiscountSchema = z.object({ type: z.enum(["percent", "fixed"]), value: z.number().positive().max(10000), reason: z.string().trim().min(3).max(200) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function guard(supabase: any, userId: string, restaurantId: string) {
  const { data: ok } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!ok) throw new Error("Réservé au gérant ou à l'agence");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("restaurants").select(RESTAURANT_COLUMNS).eq("id", restaurantId).maybeSingle();
  const r = row as unknown as Restaurant | null;
  if (!r) throw new Error("Restaurant introuvable");
  if (!posEnabled(r)) throw new Error("La caisse comptoir n'est pas activée pour ce restaurant.");
  return { r, admin: supabaseAdmin };
}

const rid = z.object({ restaurantId: z.string().uuid() });

export const getPosState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const { data: s } = await admin.from("pos_sessions").select("*").eq("restaurant_id", data.restaurantId).is("closed_at", null).maybeSingle();
    let live = null;
    if (s) {
      const { data: report, error } = await admin.rpc("pos_session_report", { _session_id: s.id });
      if (error) throw new Error("Lecture des ventes impossible.");
      live = report as unknown as ZReport;
    }
    const { data: last } = await admin.from("pos_sessions").select("id, z_number, opened_at, closed_at, z_report").eq("restaurant_id", data.restaurantId).not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(10);
    return { session: s, live, history: last ?? [] };
  });

export const openPosSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ openingFloat: z.number().min(0).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const { error } = await admin.from("pos_sessions").insert({ restaurant_id: data.restaurantId, opened_by: context.userId, opening_float: data.openingFloat });
    if (error) throw new Error(error.code === "23505" ? "Une caisse est déjà ouverte." : "Ouverture impossible.");
    return { ok: true };
  });

export const closePosSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ countedCash: z.number().min(0).max(100000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const { data: result, error } = await admin.rpc("close_pos_register", { _restaurant_id: data.restaurantId, _user_id: context.userId, _counted_cash: data.countedCash });
    if (error) throw new Error(error.message.includes("paniers") ? "Reprenez les paniers en attente avant de clôturer." : "Clôture impossible : actualisez la caisse et réessayez.");
    return result as unknown as { z_number: number; report: ZReport; opened_at: string; closed_at: string };
  });

export const createPosOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({
    mode: z.enum(["pickup", "dine_in"]),
    requestId: z.string().uuid(),
    customer_name: z.string().trim().max(60).optional(),
    lines: posLinesSchema,
    discount: posDiscountSchema.nullable().optional(),
    payments: z.array(z.object({ method: z.enum(["cash","card","meal_voucher"]), amount: z.number().positive().max(10000), given: z.number().min(0).max(10000).optional() })).min(1).max(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { r, admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const { data: existing } = await admin.from("orders").select("*").eq("restaurant_id", r.id).eq("pos_request_id", data.requestId).maybeSingle();
    if (existing) return existing as unknown as PosReceipt;
    const { data: s } = await admin.from("pos_sessions").select("id").eq("restaurant_id", r.id).is("closed_at", null).maybeSingle();
    if (!s) throw new Error("Ouvrez la caisse avant d'encaisser.");
    const { getCatalog } = await import("./catalogs");
    const { withOptions, loadOptionData } = await import("./menu-options");
    const { validateSelections, orderLine } = await import("./menu");
    const catalog = withOptions(getCatalog(r), await loadOptionData(admin, r.id));
    const now = new Date();
    const items = data.lines.map((l) => {
      const item = catalog.itemsById[l.itemId];
      if (!item) throw new Error("Article inconnu");
      assertItemAvailable(item, now);
      const err = validateSelections(item, l.sel);
      if (err) throw new Error(err);
      const category = catalog.categories.find((c) => c.items.some((i) => i.id === item.id))?.label;
      return { ...orderLine(item, l.sel, l.qty, category), vatRate: item.vatRate ?? defaultVatRate(r.legal?.vatRate) };
    });
    const subtotal = Math.round(items.reduce((a, i) => a + i.total, 0) * 100) / 100;
    const discount = directDiscount(subtotal, data.discount);
    const total = Math.round((subtotal-discount)*100)/100;
    const payments = validatePosPayments(total, data.payments.map((p)=>({method:p.method,amount:p.amount,...(p.given !== undefined ? {given:p.given} : {})})));
    const tender = payments[0];
    if (!tender) throw new Error("Règlement manquant.");
    const vat = vatBreakdown({ items, total, discount });
    const { data: row, error } = await admin.from("orders").insert({
      restaurant_id: r.id, customer_name: data.customer_name || "Comptoir", phone: "-", mode: data.mode, slot: now.toISOString(),
      items: items as never, subtotal, delivery_fee: 0, service_fee: 0, discount, total,
      pos_payments: payments as never, pos_discount: (data.discount ?? null) as never, pos_vat: vat as never,
      payment_method: posPaymentMethod(payments.every((p) => p.method === "card") ? "card" : "cash"), payment_status: "paid", source: "pos",
      status: "accepted", pos_session_id: s.id, pos_tender: tender as never, pos_request_id: data.requestId, pos_created_by: context.userId,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") {
        const { data: retry } = await admin.from("orders").select("*").eq("restaurant_id", r.id).eq("pos_request_id", data.requestId).maybeSingle();
        if (retry) return retry as unknown as PosReceipt;
      }
      console.error(error); throw new Error("Impossible d'enregistrer la vente. Vérifiez que la caisse est toujours ouverte.");
    }
    return row as unknown as PosReceipt;
  });

export const getPosReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ sessionId: z.string().uuid(), page: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const { data: rows, error, count } = await admin.from("orders").select("*", { count: "exact" }).eq("restaurant_id", data.restaurantId).eq("pos_session_id", data.sessionId).eq("source", "pos").order("pos_receipt_number", { ascending: false }).range(data.page * 30, data.page * 30 + 29);
    if (error) throw new Error("Historique des tickets indisponible.");
    return { receipts: (rows ?? []) as unknown as PosReceipt[], count: count ?? 0 };
  });

export const getPosClosures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await guard(context.supabase, context.userId, data.restaurantId);
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error } = await admin.from("pos_sessions").select("id, z_number, opened_at, closed_at, z_report").eq("restaurant_id", data.restaurantId).not("closed_at", "is", null).order("closed_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw new Error("Journal des clôtures indisponible.");
      all.push(...(rows ?? []));
      if ((rows?.length ?? 0) < 500) break;
    }
    return all;
  });
