// Cœur des jetons d'accès client : aucune dépendance à la requête courante,
// utilisable depuis les routes API (qui n'ont pas accès à @tanstack/react-start/server).
import { createHmac, timingSafeEqual } from "node:crypto";

export type Scope = "order" | "kiosk" | "reservation";
export const lifetime = (scope: Scope) => scope === "kiosk" ? 30 * 60 : 90 * 86400;
export function key() {
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
export const cookieName = (scope: Scope, id: string) => `lc_${scope}_${id}`;
/** Lit le jeton dans un en-tête Cookie brut (routes API qui reçoivent `request` directement). */
export function tokenFromCookieHeader(scope: Scope, id: string, cookieHeader: string | null) {
  const name = cookieName(scope, id);
  return (cookieHeader ?? "").split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
}
