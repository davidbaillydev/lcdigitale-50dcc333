// Moteur de synchronisation caisse (POS). Serveur uniquement : lit les identifiants
// depuis restaurant_pos_connectors (rôle service) et journalise le résultat sur la commande.
export type PosProvider = "none" | "hubrise" | "hiboutik" | "webhook";
export type PosRow = { restaurant_id: string; provider: PosProvider; credentials: Record<string, string>; settings: Record<string, string>; silent_sync: boolean };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export async function getPosRow(restaurantId: string): Promise<PosRow | null> {
  const { data } = await (await db()).from("restaurant_pos_connectors").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  return data as PosRow | null;
}

const money = (n: number) => `${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)} EUR`;
const HUBRISE = "https://api.hubrise.com/v1";

async function readError(res: Response) {
  const t = await res.text().catch(() => "");
  try { const j = JSON.parse(t); return String(j.message ?? j.error ?? j.error_description ?? t).slice(0, 300); } catch { return t.slice(0, 300) || `HTTP ${res.status}`; }
}

/** Vérifie les identifiants d'un connecteur. */
export async function testPos(p: PosRow): Promise<string> {
  const c = p.credentials;
  if (p.provider === "hubrise") {
    const res = await fetch(`${HUBRISE}/location`, { headers: { "X-Access-Token": c.accessToken ?? "" } });
    if (!res.ok) throw new Error(`HubRise : ${await readError(res)}`);
    const loc = await res.json() as { id: string; name?: string; account?: { name?: string } };
    if (p.settings.locationId && loc.id !== p.settings.locationId) throw new Error(`Le token correspond au point de vente ${loc.id}, pas à ${p.settings.locationId}.`);
    return `Connecté à ${loc.account?.name ?? ""} ${loc.name ?? ""} (${loc.id})`.replace(/\s+/g, " ");
  }
  if (p.provider === "hiboutik") {
    const res = await fetch(`https://${p.settings.account}.hiboutik.com/api/stores/`, { headers: { Authorization: `Basic ${btoa(`${p.settings.login}:${c.apiKey}`)}` } });
    if (!res.ok) throw new Error(`Hiboutik : ${await readError(res)}`);
    const stores = await res.json() as { store_id: number; store_name: string }[];
    const s = stores.find((x) => String(x.store_id) === String(p.settings.storeId));
    if (!s) throw new Error(`Boutique ${p.settings.storeId} introuvable sur ce compte.`);
    return `Connecté à Hiboutik — ${s.store_name}`;
  }
  if (p.provider === "webhook") {
    const res = await sendWebhook(p, { event: "test", sent_at: new Date().toISOString() });
    return `Point de terminaison joignable (HTTP ${res})`;
  }
  throw new Error("Aucune caisse configurée");
}

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendWebhook(p: PosRow, payload: unknown): Promise<number> {
  const url = p.settings.url ?? "";
  if (!/^https:\/\//.test(url)) throw new Error("L'URL du webhook doit commencer par https://");
  const body = JSON.stringify(payload);
  const secret = p.credentials.secret ?? "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}`, "X-LC-Signature": await hmac(secret, body) } : {}) },
    body,
  });
  if (!res.ok) throw new Error(`Webhook : ${await readError(res)}`);
  return res.status;
}

type Line = { id?: string; name: string; qty: number; unit: number; total: number; size?: string; details?: string; vatRate?: number; selected_options?: { name?: string; group?: string; price?: number }[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = Record<string, any>;

const isPaid = (o: Order) => o.payment_status === "paid";

function genericPayload(o: Order, silent: boolean) {
  return {
    event: "order.validated", source: "lc-digitale", silent_sync: silent, no_print: silent,
    order: {
      id: o.id, number: o.order_number, channel: o.source ?? "web", mode: o.mode, status: o.status, created_at: o.created_at, slot: o.slot,
      customer: { name: o.customer_name, phone: o.phone, email: o.email, address: o.address, postal_code: o.postal_code, city: o.city },
      table: o.table_label, room: o.room_label, notes: o.notes,
      items: (o.items as Line[]).map((i) => ({ sku: i.id, name: i.size ? `${i.name} [${i.size}]` : i.name, quantity: i.qty, unit_price: i.unit, total: i.total, vat_rate: i.vatRate ?? 10, options: i.selected_options ?? [], details: i.details })),
      subtotal: Number(o.subtotal), delivery_fee: Number(o.delivery_fee ?? 0), service_fee: Number(o.service_fee ?? 0), discount: Number(o.discount ?? 0), total: Number(o.total),
      payment: { method: o.payment_method, status: isPaid(o) ? "paid" : "unpaid" },
    },
  };
}

function hubriseOrder(o: Order, p: PosRow) {
  const silent = p.silent_sync;
  const service = o.mode === "delivery" ? "delivery" : o.mode === "dine_in" ? "eat_in" : "collection";
  const charges = [
    ...(Number(o.delivery_fee) > 0 ? [{ type: "delivery", name: "Frais de livraison", price: money(o.delivery_fee) }] : []),
    ...(Number(o.service_fee) > 0 ? [{ type: "other", name: "Frais de service", price: money(o.service_fee) }] : []),
  ];
  const [first, ...rest] = String(o.customer_name ?? "").split(" ");
  return {
    status: "new",
    service_type: service,
    expected_time: o.slot ?? undefined,
    asap: !!o.asap,
    ref: String(o.order_number ?? o.id),
    collection_code: String(o.order_number ?? ""),
    customer_notes: [o.notes, o.table_label && `Table ${o.table_label}`, o.room_label && `Chambre ${o.room_label}`].filter(Boolean).join(" · ") || undefined,
    items: (o.items as Line[]).map((i) => {
      const opts = (i.selected_options ?? []).map((x) => ({ option_list_name: x.group ?? "Options", name: x.name ?? "", price: money(x.price ?? 0) }));
      const optTotal = (i.selected_options ?? []).reduce((s, x) => s + Number(x.price ?? 0), 0);
      return {
        product_name: i.name, ...(i.size ? { sku_name: i.size } : {}), ...(i.id ? { sku_ref: i.id } : {}),
        price: money(i.unit - optTotal), quantity: String(i.qty), tax_rate: String(i.vatRate ?? 10),
        ...(opts.length ? { options: opts } : {}),
      };
    }),
    ...(charges.length ? { charges } : {}),
    ...(Number(o.discount) > 0 ? { discounts: [{ name: o.promo_code ? `Code ${o.promo_code}` : "Remise", price_off: money(o.discount) }] } : {}),
    ...(isPaid(o) ? { payments: [{ type: "online", name: o.payment_method === "card_terminal" ? "Carte TPE" : "Paiement en ligne", amount: money(o.total) }] } : {}),
    customer: { first_name: first || "Client", last_name: rest.join(" ") || undefined, phone: o.phone && o.phone !== "-" ? o.phone : undefined, email: o.email ?? undefined, address_1: o.address ?? undefined, postal_code: o.postal_code ?? undefined, city: o.city ?? undefined },
    custom_fields: { lc_digitale: { order_id: o.id, channel: o.source ?? "web", silent_sync: silent, no_print: silent, payment_status: isPaid(o) ? "paid" : "unpaid" } },
  };
}

async function sendHubrise(o: Order, p: PosRow): Promise<string> {
  const loc = p.settings.locationId;
  if (!loc) throw new Error("Location ID HubRise manquant");
  const res = await fetch(`${HUBRISE}/locations/${encodeURIComponent(loc)}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Access-Token": p.credentials.accessToken ?? "" },
    body: JSON.stringify(hubriseOrder(o, p)),
  });
  if (!res.ok) throw new Error(`HubRise : ${await readError(res)}`);
  return String(((await res.json()) as { id?: string }).id ?? "");
}

async function sendHiboutik(o: Order, p: PosRow): Promise<string> {
  const base = `https://${p.settings.account}.hiboutik.com/api`;
  const auth = { Authorization: `Basic ${btoa(`${p.settings.login}:${p.credentials.apiKey}`)}` };
  const form = (v: Record<string, string>) => new URLSearchParams(v);
  const res = await fetch(`${base}/sales/`, { method: "POST", headers: auth, body: form({ store_id: String(p.settings.storeId), currency_code: "EUR", vendor_id: p.settings.vendorId ?? "1", customer_id: "0" }) });
  if (!res.ok) throw new Error(`Hiboutik : ${await readError(res)}`);
  const saleId = String(((await res.json()) as { sale_id?: number }).sale_id ?? "");
  const summary = genericPayload(o, p.silent_sync).order;
  const comment = [`Commande LC Digitale n° ${summary.number} (${summary.channel})`, ...summary.items.map((i) => `${i.quantity} × ${i.name} — ${i.total.toFixed(2)} €`), `Total ${summary.total.toFixed(2)} € — ${summary.payment.status === "paid" ? "PAYÉ" : "À ENCAISSER"}`, p.silent_sync ? "Synchronisation silencieuse : ne pas imprimer" : ""].filter(Boolean).join("\n");
  await fetch(`${base}/sales/comments/`, { method: "POST", headers: auth, body: form({ sale_id: saleId, comments: comment }) }).catch(() => null);
  return saleId;
}

/** Envoie une commande à la caisse si un connecteur est actif ; journalise le résultat. Ne lève jamais. */
export async function syncOrderToPos(orderId: string, opts: { force?: boolean } = {}): Promise<{ status: "synced" | "error" | "skipped"; ref?: string; error?: string }> {
  const d = await db();
  const { data: o } = await d.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) return { status: "skipped" };
  if (["awaiting_payment", "pending_approval", "cancelled"].includes(o.status)) return { status: "skipped" };
  if (o.pos_status === "synced" && !opts.force) return { status: "synced", ref: o.pos_ref };
  const { data: r } = await d.from("restaurants").select("enabled_features").eq("id", o.restaurant_id).maybeSingle();
  const { featuresOf } = await import("./features");
  if (!featuresOf(r?.enabled_features).pos_sync) return { status: "skipped" };
  const p = await getPosRow(o.restaurant_id);
  if (!p || p.provider === "none") return { status: "skipped" };
  try {
    const ref = p.provider === "hubrise" ? await sendHubrise(o, p) : p.provider === "hiboutik" ? await sendHiboutik(o, p) : String(await sendWebhook(p, genericPayload(o, p.silent_sync)) && o.id);
    await d.from("orders").update({ pos_status: "synced", pos_ref: ref || null, pos_synced_at: new Date().toISOString(), pos_error: null }).eq("id", orderId);
    return { status: "synced", ref };
  } catch (e) {
    const error = (e as Error).message.slice(0, 400);
    console.error("[pos]", orderId, error);
    await d.from("orders").update({ pos_status: "error", pos_error: error }).eq("id", orderId);
    return { status: "error", error };
  }
}
