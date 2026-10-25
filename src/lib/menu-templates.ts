import type { Category, MenuItem, OptionGroup } from "./menu";
import { groupsFor, type OptionData } from "./menu-options";

export type MenuTemplate = { id: string; restaurant_id: string; name: string; structure: Category[]; updated_at: string };
export type StructureMapping = { itemId: string; sourceId: string };

/** A detached snapshot of configuration only, never of another restaurant's dishes or assets. */
export function captureStructure(menu: Category[], data: OptionData): Category[] {
  return menu.map((c) => ({ id: c.id, label: c.label, items: c.items.map((i) => {
    const live = groupsFor(i.id, data);
    const options = [...live.filter((g) => g.kind === "size"), ...(i.options ?? []), ...live.filter((g) => g.kind !== "size")];
    return { id: i.id, name: i.name, price: 0, builder: i.builder ?? false, options: options.map((g) => ({ ...g, choices: g.choices.map(({ soldOut: _soldOut, ...choice }) => choice) })) };
  }) }));
}

export function applyStructure(menu: Category[], template: Category[], mappings: StructureMapping[], copyPrices = false, organize = false): { menu: Category[]; applied: number } {
  const sources = new Map(template.flatMap((c) => c.items.map((i) => [i.id, { item: i, category: c }] as const)));
  const map = new Map(mappings.map((m) => [m.itemId, m.sourceId]));
  let applied = 0;
  const targetCategories = new Map<string, Category>();
  const ids = new Set(menu.flatMap((c) => [c.id, ...c.items.map((i) => i.id)]));
  const categoryId = () => { let n = 0; while (ids.has(`template-cat-${++n}`)) {} const id = `template-cat-${n}`; ids.add(id); return id; };
  const result = menu.map((c) => ({ ...c, items: c.items.flatMap((i): MenuItem[] => {
    const source = sources.get(map.get(i.id) ?? "");
    if (!source) return [i];
    applied++;
    const options: OptionGroup[] = (source.item.options ?? []).map((g, gi) => {
      const size = source.item.options?.find((x) => x.kind === "size");
      const sizeIndex = size?.choices.findIndex((x) => x.id === g.forSize) ?? -1;
      const sizeGroupIndex = source.item.options?.findIndex((x) => x.kind === "size") ?? -1;
      if (g.forSize && sizeIndex < 0) throw new Error("Le modèle contient un choix lié à un format introuvable");
      return { ...g, id: `tpl-${gi}`, ...(g.forSize && sizeIndex >= 0 ? { forSize: `tpl-${sizeGroupIndex}-${sizeIndex}` } : {}),
        extraPrice: copyPrices ? g.extraPrice ?? 0 : 0,
        choices: g.choices.map((ch, ci) => ({ id: `tpl-${gi}-${ci}`, label: ch.label, price: copyPrices ? ch.price ?? 0 : g.kind === "size" ? i.price : 0 })) };
    });
    const item = { ...i, options, builder: source.item.builder ?? false };
    if (!organize) return [item];
    let target = targetCategories.get(source.category.id);
    if (!target) { target = { id: categoryId(), label: source.category.label, items: [] }; targetCategories.set(source.category.id, target); }
    target.items.push(item);
    return [];
  }) }));
  return { menu: organize ? [...template.flatMap((c) => { const target = targetCategories.get(c.id); return target ? [target] : []; }), ...result.filter((c) => c.items.length)] : result, applied };
}