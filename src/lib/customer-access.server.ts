import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createHmac } from "node:crypto";
import { cookieName, issueAccessToken, key, lifetime, tokenFromCookieHeader, validAccessToken, type Scope } from "./customer-access-core.server";

export { issueAccessToken, validAccessToken } from "./customer-access-core.server";

export function grantAccess(scope: Scope, id: string, token = issueAccessToken(scope, id)) {
  const secure = new URL(getRequest().url).protocol === "https:" ? "; Secure" : "";
  setResponseHeader("Set-Cookie", `${cookieName(scope, id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${lifetime(scope)}${secure}`);
}
export function requireCustomerAccess(scope: Scope, id: string, suppliedToken?: string) {
  const cookie = tokenFromCookieHeader(scope, id, getRequestHeader("cookie"));
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
/** Binds a client-chosen cart id to a server-issued HttpOnly owner cookie so a known id cannot overwrite another shopper's row. */
export function cartSessionKey(clientId: string) {
  const name = "lc_cart_owner";
  let owner = (getRequestHeader("cookie") ?? "").split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!owner || !/^[a-f0-9]{32}$/.test(owner)) {
    owner = createHmac("sha256", key()).update(`${crypto.randomUUID()}:${Date.now()}`).digest("hex").slice(0, 32);
    const secure = new URL(getRequest().url).protocol === "https:" ? "; Secure" : "";
    setResponseHeader("Set-Cookie", `${name}=${owner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 86400}${secure}`);
  }
  const h = createHmac("sha256", key()).update(`cart:${owner}:${clientId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h.charAt(16), 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
