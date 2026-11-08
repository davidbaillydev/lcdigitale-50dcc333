import { z } from "zod";
import type { Category } from "./menu";
import type { OptionData } from "./menu-options";
import { countrySchema, currencySchema, moneyDecimals, type Currency } from "./money";

const reserved = new Set(["cuisine", "connexion", "agence", "commande", "suivi", "api", "admin", "espace", "reset-password", "desabonnement", "auth"]);
export const duplicateRestaurantSchema = z.object({
  sourceId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Adresse web : lettres minuscules, chiffres et tirets").min(2).max(40).refine((s) => !reserved.has(s), "Cette adresse est réservée"),
  city: z.string().trim().max(80), address: z.string().trim().max(200), phone: z.string().trim().max(30),
  email: z.union([z.string().trim().email().max(120), z.literal("")]),
  country: countrySchema, currency: currencySchema,
  copyMenu: z.boolean(), copyBrand: z.boolean(), copyOpening: z.boolean(),
  priceMode: z.enum(["keep", "zero", "multiply"]),
  coefficient: z.number().finite().positive().max(1000000),
}).strict();
export type DuplicateRestaurantInput = z.infer<typeof duplicateRestaurantSchema>;

export function duplicatePrice(value: number, input: Pick<DuplicateRestaurantInput, "priceMode" | "coefficient" | "currency">): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Prix source invalide");
  const result = input.priceMode === "zero" ? 0 : input.priceMode === "multiply" ? value * input.coefficient : value;
  const rounded = input.priceMode === "keep" ? result : Math.round((result + Number.EPSILON) * 10 ** moneyDecimals(input.currency)) / 10 ** moneyDecimals(input.currency);
  if (!Number.isFinite(rounded) || rounded > priceLimit(input.currency)) throw new Error("Prix supérieur au plafond de la devise de destination");
  return rounded;
}
const priceLimit = (currency: Currency) => currency === "EUR" ? 1000 : 1000000;

/** Detached catalog snapshot; only restaurant-scoped IDs stay stable. Global UUIDs are replaced. */
export function duplicateCatalog(menu: Category[], data: OptionData, input: DuplicateRestaurantInput, newId: () => string) {
  if (!input.copyMenu) return { menu: [] as Category[], options: { variants: [], groups: [], items: [], links: [] } as OptionData };
  const groups = new Map(data.groups.map((g) => [g.id, newId()]));
  const variants = new Map(data.variants.map((v) => [v.id, newId()]));
  const choices = new Map(data.items.map((i) => [i.id, newId()]));
  const mapped = (map: Map<string, string>, id: string) => {
    const value = map.get(id); if (!value) throw new Error("Référence de carte invalide"); return value;
  };
  const replace = (id: string) => {
    let result = id;
    for (const [old, next] of [...groups, ...variants, ...choices]) result = result.replaceAll(old, next);
    return result;
  };
  const price = (v: number) => duplicatePrice(v, input);
  const productIds = new Set(menu.flatMap((c) => c.items.map((i) => i.id)));
  const snapshot = structuredClone(menu).map((category) => ({ ...category, items: category.items.map((item) => {
    // Private photos belong to the source restaurant; never retain cross-restaurant storage links.
    const { image: _image, ...rest } = item;
    return { ...rest, price: price(item.price), ...(item.options ? { options: item.options.map((g) => ({
      ...g, id: replace(g.id), ...(g.forSize ? { forSize: replace(g.forSize) } : {}),
      ...(g.extraPrice === undefined ? {} : { extraPrice: price(g.extraPrice) }),
      choices: g.choices.map((c) => ({ ...c, id: replace(c.id), ...(c.price === undefined ? {} : { price: price(c.price) }) })),
    })) } : {}) };
  }) }));
  return { menu: snapshot, options: {
    groups: data.groups.map((g) => ({ ...g, id: mapped(groups, g.id) })),
    variants: data.variants.filter((v) => productIds.has(v.product_id)).map((v) => ({ ...v, id: mapped(variants, v.id), price: price(v.price) })),
    items: data.items.map((i) => ({ ...i, id: mapped(choices, i.id), group_id: mapped(groups, i.group_id), price: price(i.price) })),
    links: data.links.filter((l) => productIds.has(l.product_id)).map((l) => ({ ...l, id: newId(), group_id: mapped(groups, l.group_id), variant_id: l.variant_id ? mapped(variants, l.variant_id) : null })),
  } };
}