import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRestaurant } from "@/hooks/use-staff";
import { ACTIVE_STATUSES, activeBreakdown } from "@/lib/kitchen-overview";
import { BrandLogo } from "@/lib/brand";

type Counts = Record<string, { fresh: number; cooking: number; ready: number }>;

const ZERO = { fresh: 0, cooking: 0, ready: 0 };

/** Vue d'ensemble des cuisines : commandes ouvertes par restaurant, rafraîchie en direct. */
export function KitchenOverview({ restaurants }: { restaurants: StaffRestaurant[] }) {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    if (!restaurants.length) return;
    let cancelled = false;
    const load = async () => {
      const ids = restaurants.map((r) => r.id);
      const { data } = await supabase
        .from("orders")
        .select("restaurant_id, status, is_test")
        .in("restaurant_id", ids)
        .in("status", [...ACTIVE_STATUSES]);
      if (cancelled) return;
      const next: Counts = {};
      for (const r of restaurants) next[r.id] = ZERO;
      const byRestaurant = new Map<string, { status: string; is_test?: boolean }[]>();
      for (const o of data ?? []) {
        const list = byRestaurant.get(o.restaurant_id) ?? [];
        list.push(o);
        byRestaurant.set(o.restaurant_id, list);
      }
      for (const r of restaurants) next[r.id] = activeBreakdown(byRestaurant.get(r.id) ?? []);
      setCounts(next);
    };
    void load();
    const channel = supabase
      .channel("kitchen-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [restaurants]);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <ChefHat aria-hidden="true" className="h-6 w-6 text-primary" />
        <h2 className="text-2xl">Cuisines en direct</h2>
        <span className="text-sm text-muted-foreground">accès rapide à chaque écran cuisine</span>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {restaurants.map((r) => {
          const c = counts[r.id] ?? ZERO;
          const total = c.fresh + c.cooking + c.ready;
          return (
            <li key={r.id}>
              <Link
                to="/espace/$slug"
                params={{ slug: r.slug }}
                className="group flex min-h-16 flex-wrap items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandLogo src={r.logo_url} name={r.name} className="h-10 w-10 shrink-0 object-contain" />
                <span className="min-w-0 flex-1 break-words font-display text-lg font-semibold">{r.name}</span>
                {total === 0 ? (
                  <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">Aucune commande</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {c.fresh > 0 && <span className="rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground">{c.fresh} nouvelle{c.fresh > 1 ? "s" : ""}</span>}
                    {c.cooking > 0 && <span className="rounded-full border border-border px-3 py-1">{c.cooking} en préparation</span>}
                    {c.ready > 0 && <span className="rounded-full border border-border px-3 py-1">{c.ready} prête{c.ready > 1 ? "s" : ""}</span>}
                  </span>
                )}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform motion-safe:group-hover:-translate-y-0.5" aria-label={`Ouvrir la cuisine de ${r.name}`}>
                  <ArrowUpRight aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
