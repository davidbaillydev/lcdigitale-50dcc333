import { createFileRoute } from "@tanstack/react-router";
import { Crumbs } from "@/components/Crumbs";
import { ConversionFunnel } from "@/components/ConversionFunnel";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/espace/$slug/statistiques")({
  head: () => ({
    meta: [
      { title: "Tunnel de conversion & abandon — LC Digitale" },
      { name: "description", content: "Parcours client, taux de conversion et paniers abandonnés du restaurant." },
      { property: "og:title", content: "Tunnel de conversion & abandon" },
      { property: "og:description", content: "Conversion et paniers abandonnés." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { loading, restaurants } = useStaff();
  const r = restaurants.find((x) => x.slug === slug);
  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!r || r.role === "kitchen") return <p className="p-10 text-center">Réservé au gérant du restaurant et à l'agence.</p>;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-2"><Crumbs slug={slug} page="Statistiques" /><span className="mr-auto" /><ThemeToggle /></div>
      <h1 className="text-5xl">Tunnel de conversion & abandon</h1>
      <ConversionFunnel restaurantIds={[r.id]} />
    </div>
  );
}
