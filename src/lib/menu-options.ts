// Tailles / formats et groupes de suppléments gérés en base, fusionnés dans la carte (site, borne, QR, serveur).
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Catalog } from "./catalogs";
import type { MenuItem, OptionGroup } from "./menu";

export type VariantRow = { id: string; product_id: string; name: string; price: number; is_default: boolean; is_available: boolean; sort_order: number };
export type GroupRow = { id: string; name: string; min_selection: number; max_selection: number; is_required: boolean; sort_order: number };
export type OptionItemRow = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number };
export type LinkRow = { id: string; product_id: string; group_id: string; variant_id: string | null };
export type OptionData = { variants: VariantRow[]; groups: GroupRow[]; items: OptionItemRow[]; links: LinkRow[] };
export const EMPTY_OPTIONS: OptionData = { variants: [], groups: [], items: [], links: [] };

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadOptionData(client: SupabaseClient<any>, restaurantId: string): Promise<OptionData> {
  const [v, g, i, l] = await Promise.all([
    client.from("product_variants").select("id, product_id, name, price, is_default, is_available, sort_order").eq("restaurant_id", restaurantId),
    client.from("option_groups").select("id, name, min_selection, max_selection, is_required, sort_order").eq("restaurant_id", restaurantId),
    client.from("option_items").select("id, group_id, name, price, is_available, sort_order").eq("restaurant_id", restaurantId),
    client.from("product_option_groups").select("id, product_id, group_id, variant_id").eq("restaurant_id", restaurantId),
  ]);
  const num = <T extends { price: unknown }>(rows: T[] | null) => (rows ?? []).map((r) => ({ ...r, price: Number(r.price) }));
  return {
    variants: (num(v.data as VariantRow[] | null) as VariantRow[]).sort(bySort),
    groups: ((g.data ?? []) as GroupRow[]).sort(bySort),
    items: (num(i.data as OptionItemRow[] | null) as OptionItemRow[]).sort(bySort),
    links: (l.data ?? []) as LinkRow[],
  };
}

/** Groupes construits pour un plat : taille d'abord (obligatoire), puis suppléments (globaux ou liés à une taille). */
export function groupsFor(productId: string, d: OptionData): OptionGroup[] {
  const out: OptionGroup[] = [];
  const sizes = d.variants.filter((v) => v.product_id === productId);
  if (sizes.length) out.push({ id: "size", label: "Taille / format", kind: "size", min: 1, max: 1, choices: sizes.map((s) => ({ id: s.id, label: s.name, price: s.price, ...(s.is_available ? {} : { soldOut: true }) })) });
  for (const link of d.links.filter((l) => l.product_id === productId)) {
    const g = d.groups.find((x) => x.id === link.group_id);
    if (!g) continue;
    if (link.variant_id && !sizes.some((s) => s.id === link.variant_id)) continue;
    const choices = d.items.filter((i) => i.group_id === g.id).map((i) => ({ id: i.id, label: i.name, price: i.price, ...(i.is_available ? {} : { soldOut: true }) }));
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

/** Données d'options d'un restaurant, mises à jour en direct (ruptures 1 clic). */
export function useOptionData(restaurantId: string | undefined): { data: OptionData; reload: () => void } {
  const [data, setData] = useState<OptionData>(EMPTY_OPTIONS);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    const load = () => loadOptionData(supabase, restaurantId).then((d) => alive && setData(d)).catch(() => {});
    load();
    const ch = supabase.channel(`menu-options-${restaurantId}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of ["product_variants", "option_groups", "option_items", "product_option_groups"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `restaurant_id=eq.${restaurantId}` }, () => load());
    }
    ch.subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [restaurantId, tick]);
  return useMemo(() => ({ data, reload: () => setTick((t) => t + 1) }), [data]);
}
