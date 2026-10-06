import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cache client : évite de redemander la carte et les infos légales à chaque navigation.
  // Les données vivantes (commandes, ruptures, réservations) sont rafraîchies par Realtime.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
