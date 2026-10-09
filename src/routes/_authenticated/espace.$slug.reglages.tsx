import { Crumbs } from "@/components/Crumbs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { MarketingPanel } from "@/components/MarketingPanel";
import { PaymentProvidersPanel } from "@/components/PaymentProvidersPanel";
import { VapiWebPanel } from "@/components/VapiWebPanel";
import { RestaurantSettingsForm } from "@/components/RestaurantSettingsForm";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";
import { useRestaurantFeatures } from "@/hooks/use-restaurant-features";
import { PosConnectorPanel } from "@/components/PosConnectorPanel";

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
  const { isAgency } = useStaff();
  const load = useServerFn(loadRestaurantAdmin);
  const { data, error, refetch } = useQuery({ queryKey: ["restaurant-admin", slug], queryFn: () => load({ data: { slug } }), retry: false });
  const { features } = useRestaurantFeatures(data?.id);
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between"><Crumbs slug={slug} page="Réglages" /><ThemeToggle /></div>
      <h1 className="text-5xl">Réglages {data?.name ?? ""}</h1>
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {data && <RestaurantSettingsForm restaurant={data} onSaved={() => refetch()} agency={isAgency} />}
      {data && isAgency && <PaymentProvidersPanel restaurantId={data.id} />}
      {data && isAgency && features.pos_sync && <PosConnectorPanel restaurantId={data.id} />}
      {data && <VapiWebPanel key={data.id} restaurant={data} onSaved={() => refetch()} />}
      {data && <MarketingPanel restaurantId={data.id} marketing={data.config.marketing} onSaved={() => refetch()} />}
      {data && !isAgency && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Paiements en ligne, impression des tickets, logo et bannière sont gérés par votre agence LC Digitale. Contactez-la pour toute modification.</p>}
    </div>
  );
}
