import type { Category } from "./menu";

/** Move in the editor draft only, retaining the item ID and all its settings. */
export function moveMenuItem(menu: Category[], sourceId: string, itemId: string, destinationId: string): Category[] {
  if (sourceId === destinationId) return menu;
  const source = menu.find((category) => category.id === sourceId);
  const destination = menu.find((category) => category.id === destinationId);
  const item = source?.items.find((entry) => entry.id === itemId);
  if (!source || !destination || !item || destination.items.some((entry) => entry.id === itemId)) return menu;
  return menu.map((category) => {
    if (category.id === sourceId) return { ...category, items: category.items.filter((entry) => entry.id !== itemId) };
    if (category.id === destinationId) return { ...category, items: [...category.items, item] };
    return category;
  });
}