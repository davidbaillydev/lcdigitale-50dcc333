import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { getRestaurant } from "@/lib/restaurants.functions";
import { CartProvider } from "@/lib/cart";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const restaurant = await getRestaurant({ data: { slug: params.slug } });
    if (!restaurant) throw notFound();
    return { restaurant };
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
