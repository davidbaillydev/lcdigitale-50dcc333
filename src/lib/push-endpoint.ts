/** Browser push services only: never let a stored subscription aim signed requests at arbitrary hosts. */
const EXACT = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const SUFFIXES = [".push.apple.com", ".notify.windows.com", ".push.services.mozilla.com"];
export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return EXACT.has(h) || SUFFIXES.some((s) => h.endsWith(s));
  } catch { return false; }
}
