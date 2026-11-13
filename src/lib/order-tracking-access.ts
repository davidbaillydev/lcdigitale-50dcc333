/** Keep the order-only handoff in this history entry, including when storage/cookies are blocked. */
export function trackingAccess(id: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const supplied = new URL(window.location.href).searchParams.get("access");
  if (supplied && supplied.length <= 1000) return supplied;
  const saved = window.history.state?.lcOrderAccess;
  return saved?.id === id && typeof saved.access === "string" && saved.access.length <= 1000 ? saved.access : undefined;
}

/** Call only after the server has accepted the handoff. Preserve router and payment state. */
export function retainTrackingAccess(id: string, access: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("access");
  window.history.replaceState({ ...window.history.state, lcOrderAccess: { id, access } }, "", url.pathname + url.search + url.hash);
}