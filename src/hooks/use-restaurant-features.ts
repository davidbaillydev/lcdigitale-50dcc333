import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { featuresOf, type Features } from "@/lib/features";

/** Modules activés d'un restaurant, mis à jour en temps réel. */
export function useRestaurantFeatures(restaurantId: string | undefined) {
  const [state, setState] = useState<{ loading: boolean; features: Features }>({ loading: true, features: featuresOf(null) });
  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    supabase.from("restaurants").select("enabled_features").eq("id", restaurantId).maybeSingle().then(({ data }) => {
      if (alive) setState({ loading: false, features: featuresOf(data?.enabled_features) });
    });
    const ch = supabase.channel(`features-${restaurantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${restaurantId}` },
        (p) => setState({ loading: false, features: featuresOf((p.new as { enabled_features?: unknown }).enabled_features) }))
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [restaurantId]);
  return state;
}
