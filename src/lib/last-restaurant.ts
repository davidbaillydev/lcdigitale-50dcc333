/** Mémorisation locale du dernier restaurant consulté (par navigateur). */
const KEY = "lc-last-restaurant";

export function rememberLastRestaurant(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export function getLastRestaurant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
