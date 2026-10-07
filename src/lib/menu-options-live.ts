import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_OPTIONS, loadOptionData, type OptionData } from "./menu-options";

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
