// Socle commun des prestataires de paiement (accès service, lecture des clés, validation commande).

export const PROVIDERS = ["sumup", "stripe", "paypal", "lyra", "mollie"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type Row = { restaurant_id: string; provider: Provider; enabled: boolean; credentials: Record<string, string>; settings: Record<string, string> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertManager(supabase: any, userId: string, restaurantId: string) {
  void restaurantId;
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}
export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}
export async function getRow(restaurantId: string, provider: Provider): Promise<Row | null> {
  const db = await admin();
  const { data } = await db.from("restaurant_payment_providers").select("*").eq("restaurant_id", restaurantId).eq("provider", provider).maybeSingle();
  return data as Row | null;
}
export const mask = (v?: string) => (v ? `${/^(test|live)_/.test(v) ? v.slice(0, 5) : ""}••••••••${v.slice(-4)}` : "");
// Champs non secrets, réaffichés en clair dans les réglages
export const PUBLIC_FIELDS = ["merchantCode", "publishableKey", "mode", "siteId", "gateway", "profileId"];

export async function assertOrdersOpen(restaurantId: string) {
  const db = await admin();
  const { data } = await db.from("restaurants").select("config").eq("id", restaurantId).maybeSingle();
  if (!data || (data.config as { ordersPaused?: boolean } | null)?.ordersPaused === true) throw new Error("Le restaurant ne prend pas de commandes pour le moment");
}

export async function markPaid(o: { id: string; restaurant_id: string; status: string }) {
  const db = await admin();
  const { data: r } = await db.from("restaurants").select("config").eq("id", o.restaurant_id).maybeSingle();
  const next = (r?.config as { autoAccept?: boolean } | null)?.autoAccept ? "accepted" : "new";
  await db.from("orders").update({ payment_status: "paid", status: o.status === "awaiting_payment" ? next : o.status, updated_at: new Date().toISOString() }).eq("id", o.id);
  // Email de confirmation Brevo (envoyé une seule fois, seulement si la commande est acceptée)
  const { notifyNewOrder } = await import("./order-email.server");
  await notifyNewOrder(db, o.id).catch((e) => console.error(e));
  const { syncOrderToPos } = await import("./pos.server");
  await syncOrderToPos(o.id);
}
