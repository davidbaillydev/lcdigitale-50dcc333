import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook Vapi (assistant téléphonique IA) — un par restaurant.
 * Sécurité : en-tête x-vapi-secret comparé en temps constant à la clé du restaurant ; canal et restaurant doivent être actifs.
 * Outils exposés à l'assistant : get_menu, create_order. Les prix sont toujours recalculés ici.
 */
const lineSchema = z.object({ itemId: z.string().max(80), qty: z.number().int().min(1).max(50), notes: z.string().max(200).optional() });
const orderArgs = z.object({
  customer_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9 +().-]{8,20}$/),
  mode: z.enum(["pickup", "delivery"]),
  slot: z.string().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  postal_code: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(40),
});

type ToolCall = { id: string; function?: { name?: string; arguments?: unknown }; name?: string; arguments?: unknown };

export const Route = createFileRoute("/api/public/vapi/$restaurantId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!z.string().uuid().safeParse(params.restaurantId).success) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ch } = await supabaseAdmin.from("restaurant_voice_channels").select("enabled, webhook_secret, calls_count").eq("restaurant_id", params.restaurantId).maybeSingle();
        const given = request.headers.get("x-vapi-secret") ?? "";
        const { timingSafeEqual } = await import("crypto");
        const ok = !!ch && given.length === ch.webhook_secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(ch.webhook_secret));
        if (!ok) return new Response("Unauthorized", { status: 401 });
        if (!ch.enabled) return Response.json({ error: "Canal désactivé" }, { status: 403 });

        const body = (await request.json().catch(() => null)) as { message?: { type?: string; toolCallList?: ToolCall[]; toolCalls?: ToolCall[] } } | null;
        const msg = body?.message;
        if (!msg) return new Response("Bad request", { status: 400 });
        if (msg.type === "end-of-call-report") {
          await supabaseAdmin.from("restaurant_voice_channels").update({ calls_count: ch.calls_count + 1, last_call_at: new Date().toISOString() }).eq("restaurant_id", params.restaurantId);
          return Response.json({ ok: true });
        }
        if (msg.type !== "tool-calls") return Response.json({ ok: true });

        const { RESTAURANT_COLUMNS, isValidSlot, modeEnabled, deliveryFee } = await import("@/lib/shop");
        const { getCatalog } = await import("@/lib/catalogs");
        const { unitPrice, validateSelections, describeSelections } = await import("@/lib/menu");
        const { data: rRow } = await supabaseAdmin.from("restaurants").select(RESTAURANT_COLUMNS).eq("id", params.restaurantId).eq("active", true).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = rRow as any;
        if (!r) return Response.json({ results: [] });
        const catalog = getCatalog(r);

        const results = [];
        for (const call of msg.toolCallList ?? msg.toolCalls ?? []) {
          const name = call.function?.name ?? call.name;
          let raw = call.function?.arguments ?? call.arguments ?? {};
          if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
          let result: unknown;
          try {
            if (name === "get_menu") {
              result = catalog.categories.map((c) => ({
                category: c.name,
                items: c.items.filter((i) => !i.unavailable).map((i) => ({ itemId: i.id, name: i.name, price: i.price, description: i.description, allergens: i.allergens ?? "non renseignés", needsOptions: !!i.options?.some((o) => (o.min ?? 0) > 0) })),
              }));
            } else if (name === "create_order") {
              const a = orderArgs.parse(raw);
              if (!modeEnabled(r, a.mode)) throw new Error(a.mode === "delivery" ? "La livraison n'est pas proposée." : "La vente à emporter n'est pas proposée.");
              const lead = r.config?.lead?.[a.mode] ?? 30;
              const slot = a.slot ?? new Date(Date.now() + lead * 60_000).toISOString();
              if (a.slot && !isValidSlot(r, a.mode, a.slot)) throw new Error("Créneau indisponible, proposez-en un autre.");
              const items = a.lines.map((l) => {
                const item = catalog.itemsById[l.itemId];
                if (!item) throw new Error(`Article inconnu : ${l.itemId}`);
                const err = validateSelections(item, {});
                if (err) throw new Error(`${item.name} : options requises non gérables par téléphone (${err}).`);
                const unit = unitPrice(item, {});
                const details = [describeSelections(item, {}), l.notes].filter(Boolean).join(" · ");
                return { id: item.id, name: item.name, qty: l.qty, unit, total: Math.round(unit * l.qty * 100) / 100, details, ...(item.allergens?.length ? { allergens: item.allergens } : {}) };
              });
              const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
              let fee = 0; let city: string | null = null;
              if (a.mode === "delivery") {
                const zone = r.delivery.zones.find((z: { cp: string }) => z.cp === a.postal_code);
                if (!zone) throw new Error("Adresse hors zone de livraison.");
                if (!a.address || a.address.length < 5) throw new Error("Adresse de livraison requise.");
                if (subtotal < r.delivery.minOrder) throw new Error(`Minimum en livraison : ${r.delivery.minOrder} €`);
                fee = deliveryFee(r, subtotal); city = zone.city;
              }
              const total = Math.round((subtotal + fee) * 100) / 100;
              const { data: row, error } = await supabaseAdmin.from("orders").insert({
                restaurant_id: r.id, customer_name: a.customer_name, phone: a.phone, mode: a.mode,
                address: a.mode === "delivery" ? a.address ?? null : null, postal_code: a.mode === "delivery" ? a.postal_code ?? null : null, city,
                slot, items, notes: a.notes || null, subtotal, delivery_fee: fee, discount: 0, total,
                payment_method: "on_site", source: "phone", status: r.config?.autoAccept ? "accepted" : "new",
              }).select("order_number").single();
              if (error) { console.error(error); throw new Error("Impossible d'enregistrer la commande."); }
              result = { ok: true, order_number: row.order_number, total, ready_at: slot, payment: "Paiement au retrait / à la livraison" };
            } else {
              result = { error: `Outil inconnu : ${name}` };
            }
          } catch (e) {
            result = { error: e instanceof z.ZodError ? "Informations incomplètes : nom, téléphone, mode et plats requis." : (e as Error).message };
          }
          results.push({ toolCallId: call.id, result: JSON.stringify(result) });
        }
        return Response.json({ results });
      },
    },
  },
});
