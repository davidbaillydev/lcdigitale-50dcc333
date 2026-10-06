import { VAPID_PUBLIC_KEY } from "./push";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function vapidJwt(audience: string) {
  const jwk = JSON.parse(process.env["VAPID_PRIVATE_JWK"] ?? "{}");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contact@lcdigitale.fr" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

/** Push sans contenu (pas de chiffrement nécessaire) : le service worker récupère ensuite le message. */
export async function sendEmptyPush(endpoint: string) {
  const jwt = await vapidJwt(new URL(endpoint).origin);
  const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`, TTL: "86400", Urgency: "high", "Content-Length": "0" } });
  return res.status;
}

/** Enregistre le message puis réveille chaque appareil abonné (6 envois en parallèle max). */
export async function notifySubscribers(admin: Admin, filter: { order_id?: string; restaurant_id?: string; audience: string }, msg: { title: string; body: string; url: string }) {
  let q = admin.from("push_subscriptions").select("id, endpoint").eq("audience", filter.audience);
  if (filter.order_id) q = q.eq("order_id", filter.order_id);
  if (filter.restaurant_id) q = q.eq("restaurant_id", filter.restaurant_id);
  const { data: subs } = await q;
  if (!subs?.length) return 0;
  await admin.from("push_subscriptions").update({ last_title: msg.title, last_body: msg.body, last_url: msg.url, last_at: new Date().toISOString() }).in("id", subs.map((s) => s.id));
  let sent = 0;
  for (let i = 0; i < subs.length; i += 6) {
    await Promise.all(subs.slice(i, i + 6).map(async (s) => {
      try {
        const st = await sendEmptyPush(s.endpoint);
        if (st === 404 || st === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else if (st < 300) sent++;
      } catch (e) { console.error("push", e); }
    }));
  }
  return sent;
}
