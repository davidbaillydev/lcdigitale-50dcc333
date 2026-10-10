import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { CookieConsent } from "@/components/CookieConsent";
import { getRestaurant } from "@/lib/restaurants.functions";
import { CartProvider } from "@/lib/cart";
import { BrandTheme } from "@/lib/brand";
import { featuresOf } from "@/lib/features";
import { useEmbedMode } from "@/lib/embed";

// Carte, horaires et mentions légales : mis en cache 15 min côté navigateur
const restaurantQuery = (slug: string) => ({
  queryKey: ["restaurant", slug],
  queryFn: () => getRestaurant({ data: { slug } }),
  staleTime: 15 * 60_000,
});

export const Route = createFileRoute("/$slug")({
  loader: async ({ params, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryClient = (context as any).queryClient as import("@tanstack/react-query").QueryClient | undefined;
    const restaurant = queryClient ? await queryClient.ensureQueryData(restaurantQuery(params.slug)) : await getRestaurant({ data: { slug: params.slug } });
    if (!restaurant) throw notFound();
    return { restaurant };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.restaurant;
    const title = r ? `${r.name} ${r.city ?? ""} — Commandez en ligne` : "Commande en ligne";
    const desc = r ? `Carte complète de ${r.name} : click & collect ou livraison${r.city ? ` à ${r.city}` : ""}.` : "Commande en ligne.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Ce restaurant n'existe pas.</p>
      <Link to="/" className="underline">Voir nos restaurants</Link>
    </div>
  ),
  errorComponent: () => <p className="p-10 text-center">Impossible de charger ce restaurant.</p>,
  component: Layout,
});

function Layout() {
  const { restaurant } = Route.useLoaderData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!restaurant) return null;
  const staffScreen = /\/(borne|cuisine)(\/|$)/.test(path);
  const embed = useEmbedMode(restaurant.slug, featuresOf(restaurant.enabled_features).embed) && !staffScreen;
  return (
    <BrandTheme brand={restaurant.brand}>
      <CartProvider restaurant={restaurant}>
        <div {...(embed ? { "data-embed": "1" } : {})} className={embed ? "embed-compact" : undefined}>
          <Outlet />
          {!staffScreen && <CookieConsent slug={restaurant.slug} voice={!!restaurant.is_vapi_web_enabled} compact={embed} />}
        </div>
      </CartProvider>
    </BrandTheme>
  );
}
