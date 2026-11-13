/** Only the order-scoped capability belongs in tracking URLs, never an account token. */
export function orderTrackingSearch(access: string, back?: string) {
  return { access, ...(back ? { back } : {}) };
}

export function orderTrackingReturnUrl(origin: string, slug: string, id: string, access: string, back?: string) {
  const url = new URL(`/${encodeURIComponent(slug)}/suivi/${encodeURIComponent(id)}`, origin);
  url.search = new URLSearchParams(orderTrackingSearch(access, back)).toString();
  return url.href;
}