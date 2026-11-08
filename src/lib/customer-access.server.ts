import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";

type Scope = "order" | "kiosk" | "reservation";
const lifetime = (scope: Scope) => scope === "kiosk" ? 30 * 60 : 90 * 86400;
function key() {
  const secret = process.env["CUSTOMER_ACCESS_SECRET"];
  if (!secret) throw new Error("Accès sécurisé indisponible.");
  return secret;
}
export function issueAccessToken(scope: Scope, id: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ scope, id, expires: now + lifetime(scope) * 1000 })).toString("base64url");
  return `${body}.${createHmac("sha256", key()).update(body).digest("base64url")}`;
}
export function validAccessToken(token: string | undefined, scope: Scope, id: string, now = Date.now()) {
  if (!token || token.length > 1000) return false;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra) return false;
  const expected = Buffer.from(createHmac("sha256", key()).update(body).digest("base64url"));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.scope === scope && p.id === id && Number.isFinite(p.expires) && p.expires > now; } catch { return false; }
}
const cookieName = (scope: Scope, id: string) => `lc_${scope}_${id}`;
export function grantAccess(scope: Scope, id: string, token = issueAccessToken(scope, id)) {
  const secure = new URL(getRequest().url).protocol === "https:" ? "; Secure" : "";
  setResponseHeader("Set-Cookie", `${cookieName(scope, id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${lifetime(scope)}${secure}`);
}
export function requireCustomerAccess(scope: Scope, id: string, suppliedToken?: string) {
  const name = cookieName(scope, id);
  const cookie = (getRequestHeader("cookie") ?? "").split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!validAccessToken(suppliedToken ?? cookie, scope, id)) throw new Error("Accès refusé : utilisez le lien sécurisé reçu après votre commande.");
  setResponseHeader("Cache-Control", "no-store");
  if (suppliedToken) grantAccess(scope, id, suppliedToken);
}
/** Trusted edge address only; arbitrary forwarding headers never authorize throttling. */
export function kioskAttemptKey(restaurantId: string) {
  const request = getRequest();
  const host = new URL(request.url).hostname;
  const address = request.headers.get("cf-connecting-ip") ?? (host === "localhost" || host === "127.0.0.1" ? "local-development" : null);
  if (!address) throw new Error("Vérification temporairement indisponible.");
  return createHmac("sha256", key()).update(`kiosk-pin:${restaurantId}:${address}`).digest("hex");
}