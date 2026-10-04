/** Les 14 allergènes majeurs (règlement UE INCO n° 1169/2011, annexe II). */
export const ALLERGENS = [
  { id: "gluten", label: "Gluten", icon: "🌾" },
  { id: "crustaces", label: "Crustacés", icon: "🦐" },
  { id: "oeufs", label: "Œufs", icon: "🥚" },
  { id: "poissons", label: "Poissons", icon: "🐟" },
  { id: "arachides", label: "Arachides", icon: "🥜" },
  { id: "soja", label: "Soja", icon: "🫘" },
  { id: "lait", label: "Lait / Lactose", icon: "🥛" },
  { id: "fruits-coque", label: "Fruits à coque", icon: "🌰" },
  { id: "celeri", label: "Céleri", icon: "🥬" },
  { id: "moutarde", label: "Moutarde", icon: "🟡" },
  { id: "sesame", label: "Sésame", icon: "⚪" },
  { id: "sulfites", label: "Sulfites", icon: "🍷" },
  { id: "lupin", label: "Lupin", icon: "🌼" },
  { id: "mollusques", label: "Mollusques", icon: "🦑" },
] as const;
export type AllergenId = (typeof ALLERGENS)[number]["id"];
export const ALLERGEN_IDS = ALLERGENS.map((a) => a.id) as [AllergenId, ...AllergenId[]];
const BY_ID = Object.fromEntries(ALLERGENS.map((a) => [a.id, a])) as Record<string, (typeof ALLERGENS)[number]>;
export const allergenLabel = (id: string) => BY_ID[id]?.label ?? id;
export const allergenIcon = (id: string) => BY_ID[id]?.icon ?? "⚠";
export const cleanAllergens = (ids: unknown): AllergenId[] =>
  Array.isArray(ids) ? ALLERGEN_IDS.filter((a) => ids.includes(a)) : [];
/** true si le plat ne contient aucun des allergènes exclus. Un plat non renseigné est masqué dès qu'un filtre est actif (prudence). */
export const safeFor = (item: { allergens?: string[] | undefined }, excluded: string[]) =>
  !excluded.length || (Array.isArray(item.allergens) && !item.allergens.some((a) => excluded.includes(a)));
