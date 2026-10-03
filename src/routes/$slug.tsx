import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { getRestaurant } from "@/lib/restaurants.functions";
import { CartProvider } from "@/lib/cart";

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
  return (
    <CartProvider restaurant={restaurant}>
      <Outlet />
    </CartProvider>
  );
}
