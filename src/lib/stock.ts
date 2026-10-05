import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Plats en rupture temporaire d'un restaurant, synchronisés en temps réel. */
export function useSoldOut(restaurantId: string | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("menu_stock").select("item_id, sold_out").eq("restaurant_id", restaurantId);
      if (alive) setIds(new Set((data ?? []).filter((r) => r.sold_out).map((r) => r.item_id)));
    };
    load();
    const ch = supabase
      .channel(`menu-stock-${restaurantId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_stock", filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [restaurantId]);
  return ids;
}

export async function setSoldOut(restaurantId: string, itemId: string, soldOut: boolean) {
  const q = soldOut
    ? supabase.from("menu_stock").upsert({ restaurant_id: restaurantId, item_id: itemId, sold_out: true })
    : supabase.from("menu_stock").delete().eq("restaurant_id", restaurantId).eq("item_id", itemId);
  const { error } = await q;
  if (error) throw error;
}
