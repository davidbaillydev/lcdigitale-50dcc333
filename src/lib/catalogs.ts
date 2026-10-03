// Registre des cartes par restaurant (clé = restaurants.menu_key). Ajouter ici la carte d'un nouveau restaurant.
import { CATEGORIES as WOKNSUSHI, type Category, type MenuItem } from "./menu";

export type Catalog = { categories: Category[]; itemsById: Record<string, MenuItem | undefined> };

function build(all: Category[]): Catalog {
  const categories = all.map((c) => ({ ...c, items: c.items.filter((i) => !i.hidden) })).filter((c) => c.items.length);
  return { categories, itemsById: Object.fromEntries(categories.flatMap((c) => c.items.map((i) => [i.id, i]))) };
}

const BASE: Record<string, Category[]> = { woknsushi: WOKNSUSHI };
const CATALOGS: Record<string, Catalog> = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, build(v)]));

const EMPTY: Catalog = { categories: [], itemsById: {} };
/** Carte du restaurant : sa carte personnalisée (back-office) si elle existe, sinon la carte de base en code. */
export function getCatalog(r: { menu_key: string; menu?: Category[] | null }): Catalog {
  if (r.menu && r.menu.length) return build(r.menu);
  return CATALOGS[r.menu_key] ?? EMPTY;
}

/** Catégories de base (copie de départ pour le back-office). */
export function baseCategories(menuKey: string): Category[] {
  return structuredClone(BASE[menuKey] ?? []);
}

export const BLANK_MENU = "vierge";
/** Choix proposés à la création : carte vierge (par défaut) puis modèles. */
export const MENU_KEYS = [BLANK_MENU, ...Object.keys(CATALOGS)];
export const MENU_LABELS: Record<string, string> = { [BLANK_MENU]: "Carte vierge", woknsushi: "Modèle Wok & Sushi" };
