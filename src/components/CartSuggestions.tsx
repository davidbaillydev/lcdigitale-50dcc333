import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { euro, fromPrice, type MenuItem } from "@/lib/menu";
import { useOrdersPaused } from "@/hooks/use-orders-paused";
import { ItemDialog } from "@/components/ItemDialog";
import { cn } from "@/lib/utils";
import { isItemAvailable } from "@/lib/shop";
import { useMenuClock } from "@/hooks/use-menu-clock";

const KINDS: [string, RegExp][] = [
  ["drink", /boisson|drink|soda|bi[eè]re|vin|jus|eau|th[eé]|caf[eé]/i],
  ["dessert", /dessert|douceur|sucr|glace|mochi|p[aâ]tisserie/i],
  ["sauce", /sauce/i],
  ["side", /accompagnement|side|riz|frite|entr[eé]e|nem|gyoza|salade|soupe/i],
];

/** Plat simple = aucun choix obligatoire. */
export const isSimple = (i: MenuItem) => !i.builder && !(i.options ?? []).some((g) => g.min > 0);

/** Suggestions : boissons, desserts, sauces, accompagnements absents du panier (1 par famille puis complément). */
export function useSuggestions(max = 4): MenuItem[] {
  const now = useMenuClock();
  const { catalog, lines, restaurant } = useCart();
  const up = restaurant.config.upsell;
  return useMemo(() => {
    const inCart = new Set(lines.map((l) => l.itemId));
    const manual: MenuItem[] = [];
    if (up?.mode === "manual") {
      const ids = [...(up.itemIds ?? []), ...catalog.categories.filter((c) => up.categoryIds?.includes(c.id)).flatMap((c) => c.items.map((i) => i.id))];
      for (const id of ids) { const it = catalog.itemsById[id]; if (it && (!it.schedule || !!now && isItemAvailable(it, now)) && !inCart.has(id) && !manual.includes(it)) manual.push(it); }
      if (manual.length) return manual.slice(0, max);
    }
    const kindsInCart = new Set<string>();
    const byKind: Record<string, MenuItem[]> = {};
    for (const c of catalog.categories) {
      const kind = KINDS.find(([, re]) => re.test(c.label))?.[0];
      if (!kind) continue;
      if (c.items.some((i) => inCart.has(i.id))) kindsInCart.add(kind);
      byKind[kind] = [...(byKind[kind] ?? []), ...c.items.filter((i) => !inCart.has(i.id) && (!i.schedule || !!now && isItemAvailable(i, now)))];
    }
    // Familles absentes du panier d'abord, puis plats simples et moins chers en premier
    const order = KINDS.map(([k]) => k).sort((a, b) => Number(kindsInCart.has(a)) - Number(kindsInCart.has(b)));
    const lists = order.map((k) => (byKind[k] ?? []).slice().sort((a, b) => Number(isSimple(b)) - Number(isSimple(a)) || (fromPrice(a) ?? a.price) - (fromPrice(b) ?? b.price)));
    const out: MenuItem[] = [];
    for (let round = 0; out.length < max && lists.some((l) => l[round]); round++) {
      for (const l of lists) { const it = l[round]; if (it && out.length < max) out.push(it); }
    }
    return out;
  }, [catalog, lines, max, up, now]);
}

export function CartSuggestions({ className }: { className?: string }) {
  const { add, lines, restaurant } = useCart();
  const paused = useOrdersPaused(restaurant);
  const items = useSuggestions(4);
  const [open, setOpen] = useState<MenuItem | null>(null);
  if (!lines.length || !items.length || paused) return null;
  return (
    <section className={cn("space-y-2", className)} aria-label="Suggestions pour compléter votre commande">
      <p className="text-sm font-semibold text-muted-foreground">Pour accompagner votre commande</p>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {items.map((i) => {
          const simple = isSimple(i);
          return (
            <div key={i.id} className="flex w-36 shrink-0 snap-start flex-col justify-between gap-2 rounded-lg border border-border bg-card p-2">
              <p className="line-clamp-2 text-sm font-medium leading-tight">{i.name}</p>
              <button
                type="button"
                onClick={() => { if (simple) { add(i.id, {}); toast.success(`${i.name} ajouté`); } else setOpen(i); }}
                className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-secondary px-2 text-xs font-semibold text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {simple ? `Ajouter ${euro(i.price)}` : `Choisir · ${euro(fromPrice(i) ?? i.price)}`}
              </button>
            </div>
          );
        })}
      </div>
      <ItemDialog item={open} onClose={() => setOpen(null)} />
    </section>
  );
}
