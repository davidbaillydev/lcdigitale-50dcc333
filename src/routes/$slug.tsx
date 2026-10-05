import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { CookieConsent } from "@/components/CookieConsent";
import { getRestaurant } from "@/lib/restaurants.functions";
import { CartProvider } from "@/lib/cart";
import { BrandTheme } from "@/lib/brand";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const restaurant = await getRestaurant({ data: { slug: params.slug } });
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
  return (
    <BrandTheme brand={restaurant.brand}>
      <CartProvider restaurant={restaurant}>
        <Outlet />
        {!staffScreen && <CookieConsent slug={restaurant.slug} voice={!!restaurant.is_vapi_web_enabled} />}
      </CartProvider>
    </BrandTheme>
  );
}
