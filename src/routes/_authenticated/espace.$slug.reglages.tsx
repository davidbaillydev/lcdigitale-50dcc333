import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { RestaurantSettingsForm } from "@/components/RestaurantSettingsForm";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/espace/$slug/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages du restaurant — LC Digitale" },
      { name: "description", content: "Horaires, commandes, paiements et livraison du restaurant." },
      { property: "og:title", content: "Réglages du restaurant" },
      { property: "og:description", content: "Horaires, commandes et livraison." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const load = useServerFn(loadRestaurantAdmin);
  const { data, error, refetch } = useQuery({ queryKey: ["restaurant-admin", slug], queryFn: () => load({ data: { slug } }), retry: false });
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between"><Button asChild variant="ghost"><Link to="/espace/$slug" params={{ slug }}><ArrowLeft /> Écran cuisine</Link></Button><ThemeToggle /></div>
      <h1 className="text-5xl">Réglages {data?.name ?? ""}</h1>
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {data && <RestaurantSettingsForm restaurant={data} onSaved={() => refetch()} />}
    </div>
  );
}
