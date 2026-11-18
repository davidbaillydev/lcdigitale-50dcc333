const SHORT_RESTAURANT_PATHS = new Set([
  "/borne",
  "/commande",
  "/cuisine",
  "/reserver",
  "/cgv",
  "/confidentialite",
  "/mentions-legales",
  "/cookies",
]);

/**
 * Chemin court réellement rattaché à un restaurant.
 * null signifie route globale, asset, chemin déjà préfixé ou adresse inconnue :
 * dans tous ces cas, le serveur ne doit pas rediriger.
 */
export function customDomainPath(pathname: string): string | null {
  if (pathname === "/") return "";
  const path = pathname.replace(/\/+$/, "");
  const lower = path.toLowerCase();
  if (SHORT_RESTAURANT_PATHS.has(lower)) return lower;
  if (/^\/suivi\/[a-z0-9-]+$/i.test(path)) return path;
  return null;
}

export function customDomainLocation(url: URL, slug: string): string | null {
  const path = customDomainPath(url.pathname);
  return path === null ? null : `/${slug}${path}${url.search}`;
}
