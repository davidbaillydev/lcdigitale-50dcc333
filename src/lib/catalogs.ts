// Registre des cartes par restaurant (clé = restaurants.menu_key). Ajouter ici la carte d'un nouveau restaurant.
import { CATEGORIES as WOKNSUSHI, type Category, type MenuItem } from "./menu";

export type Catalog = { categories: Category[]; itemsById: Record<string, MenuItem | undefined> };

function build(categories: Category[]): Catalog {
  return { categories, itemsById: Object.fromEntries(categories.flatMap((c) => c.items.map((i) => [i.id, i]))) };
}

const CATALOGS: Record<string, Catalog> = {
  woknsushi: build(WOKNSUSHI),
};

const EMPTY: Catalog = { categories: [], itemsById: {} };
export function getCatalog(menuKey: string): Catalog {
  return CATALOGS[menuKey] ?? EMPTY;
}

export const MENU_KEYS = Object.keys(CATALOGS);
