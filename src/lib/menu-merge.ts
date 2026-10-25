import type { Category } from "./menu";

export type MenuMergeSummary = {
  addedItems: number;
  enrichedCategories: number;
  createdCategories: number;
  skippedDuplicates: number;
};

// Exact names, ignoring case and surrounding whitespace only; no fuzzy matching.
const nameKey = (name: string) => name.trim().toLocaleLowerCase("fr-FR");

/** Pure draft merge: preserve existing records and never reuse imported IDs. */
export function mergeMenu(existing: Category[], incoming: Category[]): { menu: Category[]; summary: MenuMergeSummary } {
  const menu = existing.map((category) => ({ ...category, items: [...category.items] }));
  const ids = new Set(existing.flatMap((category) => [category.id, ...category.items.map((item) => item.id)]));
  let sequence = 0;
  const nextId = (kind: string) => {
    let id: string;
    do { id = `import-${kind}-${++sequence}`; } while (ids.has(id));
    ids.add(id);
    return id;
  };
  const names = new Set(existing.flatMap((category) => category.items.map((item) => nameKey(item.name))));
  const originalCategories = new Set(existing.map((category) => category.id));
  const enriched = new Set<string>();
  const summary: MenuMergeSummary = { addedItems: 0, enrichedCategories: 0, createdCategories: 0, skippedDuplicates: 0 };

  for (const imported of incoming) {
    let target = menu.find((category) => nameKey(category.label) === nameKey(imported.label));
    for (const item of imported.items) {
      const key = nameKey(item.name);
      if (names.has(key)) { summary.skippedDuplicates++; continue; }
      if (!target) {
        target = { ...imported, id: nextId("cat"), items: [] };
        menu.push(target);
        summary.createdCategories++;
      }
      target.items.push({ ...item, id: nextId("item") });
      names.add(key);
      summary.addedItems++;
      if (originalCategories.has(target.id)) enriched.add(target.id);
    }
  }
  summary.enrichedCategories = enriched.size;
  return { menu, summary };
}

export function menuMergeSummaryText(summary: MenuMergeSummary): string {
  return `${summary.addedItems} nouveau(x) plat(s) · ${summary.enrichedCategories} catégorie(s) enrichie(s) · ${summary.createdCategories} catégorie(s) créée(s) · ${summary.skippedDuplicates} doublon(s) ignoré(s)`;
}