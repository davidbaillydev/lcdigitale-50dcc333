import { useQuery } from "@tanstack/react-query";
import { getOrderingStatus } from "@/lib/restaurants.functions";
import { ordersPaused, type Restaurant } from "@/lib/shop";

/** Commandes suspendues ? Relu sans cache au chargement puis toutes les 30 s. */
export function useOrdersPaused(restaurant: Pick<Restaurant, "slug" | "config">) {
  const q = useQuery({
    queryKey: ["ordering-status", restaurant.slug],
    queryFn: () => getOrderingStatus({ data: { slug: restaurant.slug } }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  return q.data ? q.data.paused : ordersPaused(restaurant);
}
