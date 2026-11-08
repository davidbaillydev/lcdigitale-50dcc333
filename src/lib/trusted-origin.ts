/** Exact application origins; no wildcard, suffix or caller-provided ref trust. */
const ORIGINS = new Set([
  "https://restaurant.lcdigitale.fr", "https://lcdigitale.lovable.app",
  "https://id-preview--ef4b1d64-ea31-491e-adcc-0d022b6d298c.lovable.app",
  "https://commande.tacos-house.fr", "https://commande.istanbulaucamville.com",
  "https://commande.miamicrousty.com", "https://commande.indianfoodblagnac.com",
  "https://commande.frenchpouletbraise.com", "https://commande.woknsushi.com",
  "http://localhost:8080", "http://127.0.0.1:8080",
]);
export function trustedOrigin(value?: string | null): string {
  if (!value) return "https://restaurant.lcdigitale.fr";
  const u = new URL(value);
  if (u.username || u.password || u.pathname !== "/" || u.search || u.hash || !ORIGINS.has(u.origin)) throw new Error("Domaine de retour non autorisé.");
  return u.origin;
}