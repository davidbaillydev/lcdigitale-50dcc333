// SumUp : API, tests de clés et appairage du lecteur.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertManager, getRow } from "./shared";

export const SUMUP = "https://api.sumup.com";

export async function sumup(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${SUMUP}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    console.error("SumUp", path, res.status, text.slice(0, 500));
    const msg = (body as { detail?: string; message?: string; errors?: { detail?: string } })?.detail
      ?? (body as { message?: string })?.message ?? `erreur ${res.status}`;
    throw new Error(`SumUp : ${msg}`);
  }
  return body;
}

/** Vérifie les clés SumUp et liste les terminaux associés au compte. */
export const testSumup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "sumup");
    if (!r?.credentials["apiKey"] || !r.credentials["merchantCode"]) throw new Error("Enregistrez d'abord la clé API et le code marchand.");
    const body = await sumup(`/v0.1/merchants/${encodeURIComponent(r.credentials["merchantCode"])}/readers`, r.credentials["apiKey"]) as { items?: { id: string; name: string; status: string }[] };
    return { readers: (body?.items ?? []).map((x) => ({ id: x.id, name: x.name, status: x.status })) };
  });

/** Associe un terminal SumUp (Solo) avec le code affiché sur l'appareil. */
export const pairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    pairingCode: z.string().trim().max(20).optional(),
    readerId: z.string().trim().max(80).optional(),
    name: z.string().trim().min(1).max(60).default("Borne"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "sumup");
    if (!r?.credentials["apiKey"] || !r.credentials["merchantCode"]) throw new Error("Enregistrez d'abord la clé API et le code marchand.");
    let readerId = data.readerId; let readerName = data.name;
    if (!readerId) {
      if (!data.pairingCode) throw new Error("Saisissez le code d'association affiché sur le terminal.");
      const body = await sumup(`/v0.1/merchants/${encodeURIComponent(r.credentials["merchantCode"])}/readers`, r.credentials["apiKey"], {
        method: "POST", body: JSON.stringify({ pairing_code: data.pairingCode.toUpperCase(), name: data.name }),
      }) as { id: string; name: string };
      readerId = body.id; readerName = body.name;
    }
    const db = await admin();
    await db.from("restaurant_payment_providers").update({ settings: { ...r.settings, readerId, readerName } })
      .eq("restaurant_id", data.restaurantId).eq("provider", "sumup");
    return { readerId, readerName };
  });

export async function sumupForRestaurant(restaurantId: string) {
  const r = await getRow(restaurantId, "sumup");
  if (!r?.enabled || !r.credentials["apiKey"] || !r.credentials["merchantCode"] || !r.settings["readerId"]) return null;
  return { apiKey: r.credentials["apiKey"], merchant: encodeURIComponent(r.credentials["merchantCode"]), reader: encodeURIComponent(r.settings["readerId"]) };
}
