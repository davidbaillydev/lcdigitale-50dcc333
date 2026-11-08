// Tailles / formats et groupes de suppléments gérés en base, fusionnés dans la carte (site, borne, QR, serveur).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "./catalogs";
import type { MenuItem, OptionGroup } from "./menu";

export type VariantRow = { id: string; product_id: string; name: string; price: number; is_default: boolean; is_available: boolean; sort_order: number };
export type GroupRow = { id: string; name: string; min_selection: number; max_selection: number; is_required: boolean; sort_order: number };
export type OptionItemRow = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number };
export type LinkRow = { id: string; product_id: string; group_id: string; variant_id: string | null };
export type OptionData = { variants: VariantRow[]; groups: GroupRow[]; items: OptionItemRow[]; links: LinkRow[] };
export const EMPTY_OPTIONS: OptionData = { variants: [], groups: [], items: [], links: [] };

const bySort = <T extends { id: string; sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadOptionData(client: SupabaseClient<any>, restaurantId: string): Promise<OptionData> {
  const { data, error } = await client.rpc("read_restaurant_menu_options", { _restaurant_id: restaurantId });
  if (error) throw new Error("Lecture des options impossible");
  const options = data as OptionData | null;
  const num = <T extends { price: unknown }>(rows: T[] | null) => (rows ?? []).map((r) => ({ ...r, price: Number(r.price) }));
  return {
    variants: num(options?.variants ?? null).sort(bySort),
    groups: (options?.groups ?? []).sort(bySort),
    items: num(options?.items ?? null).sort(bySort),
    links: options?.links ?? [],
  };
}

/** Groupes construits pour un plat : taille d'abord (obligatoire), puis suppléments (globaux ou liés à une taille). */
export function groupsFor(productId: string, d: OptionData): OptionGroup[] {
  const out: OptionGroup[] = [];
  const sizes = d.variants.filter((v) => v.product_id === productId).sort(bySort);
  if (sizes.length) out.push({ id: "size", label: "Taille / format", kind: "size", min: 1, max: 1, choices: sizes.map((s) => ({ id: s.id, label: s.name, price: s.price, ...(s.is_available ? {} : { soldOut: true }) })) });
  const ranks = new Map([...d.groups].sort(bySort).map((g, index) => [g.id, index]));
  for (const link of d.links.filter((l) => l.product_id === productId).sort((a, b) => (ranks.get(a.group_id) ?? 0) - (ranks.get(b.group_id) ?? 0) || a.id.localeCompare(b.id))) {
    const g = d.groups.find((x) => x.id === link.group_id);
    if (!g) continue;
    if (link.variant_id && !sizes.some((s) => s.id === link.variant_id)) continue;
    const choices = d.items.filter((i) => i.group_id === g.id).sort(bySort).map((i) => ({ id: i.id, label: i.name, price: i.price, ...(i.is_available ? {} : { soldOut: true }) }));
    if (!choices.length) continue;
    const min = g.is_required ? Math.max(1, g.min_selection) : g.min_selection;
    out.push({
      id: link.variant_id ? `og-${g.id}-${link.variant_id}` : `og-${g.id}`, label: g.name, kind: "extra",
      min, max: Math.max(min, g.max_selection), choices, ...(link.variant_id ? { forSize: link.variant_id } : {}),
    });
  }
  return out;
}

export function withOptions(catalog: Catalog, d: OptionData): Catalog {
  if (!d.variants.length && !d.links.length) return catalog;
  const patch = (i: MenuItem): MenuItem => {
    const extra = groupsFor(i.id, d);
    return extra.length ? { ...i, options: [...extra.filter((g) => g.kind === "size"), ...(i.options ?? []), ...extra.filter((g) => g.kind !== "size")] } : i;
  };
  const categories = catalog.categories.map((c) => ({ ...c, items: c.items.map(patch) }));
  return { categories, itemsById: Object.fromEntries(categories.flatMap((c) => c.items.map((i) => [i.id, i]))) };
}

