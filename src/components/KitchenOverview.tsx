import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRestaurant } from "@/hooks/use-staff";
import { ACTIVE_STATUSES, activeBreakdown, startOfTodayIso } from "@/lib/kitchen-overview";

export type KitchenCounts = { fresh: number; cooking: number; ready: number };
export const ZERO_COUNTS: KitchenCounts = { fresh: 0, cooking: 0, ready: 0 };

/** Commandes ouvertes par restaurant, rafraîchies en direct (RLS navigateur + un canal Realtime). */
export function useKitchenCounts(restaurants: StaffRestaurant[]) {
  const [counts, setCounts] = useState<Record<string, KitchenCounts>>({});
  useEffect(() => {
    if (!restaurants.length) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("restaurant_id, status, is_test")
        .in("restaurant_id", restaurants.map((r) => r.id))
        .in("status", [...ACTIVE_STATUSES])
        .gte("created_at", startOfTodayIso());
      if (cancelled) return;
      const by = new Map<string, { status: string; is_test?: boolean }[]>();
      for (const o of data ?? []) by.set(o.restaurant_id, [...(by.get(o.restaurant_id) ?? []), o]);
      const next: Record<string, KitchenCounts> = {};
      for (const r of restaurants) next[r.id] = activeBreakdown(by.get(r.id) ?? []);
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
  return counts;
}
