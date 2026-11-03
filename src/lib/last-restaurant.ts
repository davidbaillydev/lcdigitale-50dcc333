/** Mémorisation locale du dernier restaurant consulté (par navigateur). */
const KEY = "lc-last-restaurant";

/** Seul un compte non-agence avec un établissement peut éviter le sélecteur. */
export function automaticRestaurant<T extends { slug: string; role?: string }>(restaurants: readonly T[], isAgency: boolean): T | null {
  if (isAgency || restaurants.length !== 1) return null;
  const restaurant = restaurants[0];
  return restaurant && restaurant.role !== "agency" ? restaurant : null;
}

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
