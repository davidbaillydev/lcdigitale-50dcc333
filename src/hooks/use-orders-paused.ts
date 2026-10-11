import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { availableSlots, isOpenNow, modeEnabled, ordersPaused, timingOf, type Restaurant } from "@/lib/shop";

type Live = Pick<Restaurant, "config" | "opening">;

/** Réglages de commande du restaurant, relus au chargement puis poussés en direct (Realtime). */
export function useLiveRestaurant<R extends Pick<Restaurant, "id" | "config"> & { opening?: Restaurant["opening"] }>(restaurant: R): R {
  const [live, setLive] = useState<Live | null>(null);
  const id = restaurant.id;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    supabase.from("restaurants").select("config, opening").eq("id", id).maybeSingle().then(({ data }) => {
      if (alive && data) setLive(data as unknown as Live);
    });
    const channel = supabase
      .channel(`restaurant-live-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${id}` }, (p) => {
        const n = p.new as Partial<Live>;
        if (n.config) setLive({ config: n.config, opening: n.opening ?? restaurant.opening ?? {} } as Live);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return live ? { ...restaurant, config: live.config, opening: live.opening } : restaurant;
}

export function useOrdersPaused(restaurant: Pick<Restaurant, "id" | "config"> & { opening?: Restaurant["opening"] }) {
  return ordersPaused(useLiveRestaurant(restaurant));
}

/** État de prise de commande en ligne (site / page commande). */
export function useOrderingState(restaurant: Restaurant) {
  const r = useLiveRestaurant(restaurant);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60_000); return () => clearInterval(t); }, []);
  void tick;
  const paused = ordersPaused(r);
  const modes = (["pickup", "delivery"] as const).filter((m) => modeEnabled(r, m));
  const onlineOff = modes.length === 0;
  const t = timingOf(r);
  const openNow = modes.some((m) => isOpenNow(r, m));
  const canSchedule = t.scheduled && modes.some((m) => availableSlots(r, m).length > 0);
  const closed = !onlineOff && !(t.asap && openNow) && !canSchedule;
  const showClosed = !onlineOff && !openNow;
  return { restaurant: r, paused, onlineOff, closed, showClosed, blocked: paused || onlineOff || closed };
}
