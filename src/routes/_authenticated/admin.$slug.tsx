import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ChefHat, ExternalLink, Tablet, Users, UtensilsCrossed } from "lucide-react";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { RestaurantSettingsForm } from "@/components/RestaurantSettingsForm";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { BrandLogo } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/$slug")({
  head: () => ({
    meta: [
      { title: "Fiche restaurant — Console LC Digitale" },
      { name: "description", content: "Configuration complète d'un restaurant partenaire." },
      { property: "og:title", content: "Fiche restaurant" },
      { property: "og:description", content: "Configuration d'un restaurant." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const load = useServerFn(loadRestaurantAdmin);
  const { data: r, error, refetch } = useQuery({ queryKey: ["restaurant-admin", slug], queryFn: () => load({ data: { slug } }), retry: false });
  const steps = r ? [
    ["Identité & marque", !!(r.address && r.phone)],
    ["Horaires", Object.values(r.opening ?? {}).some((x) => x.length)],
    ["Commandes & livraison", !!r.config?.modes || (r.delivery?.zones?.length ?? 0) > 0],
    ["Carte", !!r.menu || !!r.menu_key],
  ] as const : [];
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex items-center justify-between"><Button asChild variant="ghost"><Link to="/admin"><ArrowLeft /> Console agence</Link></Button><ThemeToggle /></div>
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {r && (
        <>
          <div className="flex items-center gap-4">
            <BrandLogo src={r.logo_url} name={r.name} className="h-16 w-16 rounded-lg object-contain" />
            <div><h1 className="text-5xl">{r.name}</h1><p className="text-muted-foreground">/{r.slug} · {r.active ? "En ligne" : "Hors ligne"}</p></div>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {steps.map(([l, ok], i) => (
              <li key={l} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span className={ok ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex h-6 w-6 items-center justify-center rounded-full border border-border"}>{ok ? <Check className="h-4 w-4" /> : i + 1}</span>{l}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/espace/$slug/carte" params={{ slug }}><UtensilsCrossed /> Carte & import</Link></Button>
            <Button asChild variant="secondary"><Link to="/espace/$slug/equipe" params={{ slug }}><Users /> Équipe & invitations</Link></Button>
            <Button asChild variant="secondary"><Link to="/espace/$slug" params={{ slug }}><ChefHat /> Cuisine</Link></Button>
            <Button asChild variant="secondary"><a href={`/${slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Site</a></Button>
            <Button asChild variant="secondary"><a href={`/${slug}/borne`} target="_blank" rel="noreferrer"><Tablet /> Borne</a></Button>
          </div>
          <p className="text-sm text-muted-foreground">Identité, logo et couleurs se modifient depuis la console (bouton « Modifier »).</p>
          <RestaurantSettingsForm restaurant={r} onSaved={() => refetch()} />
        </>
      )}
    </div>
  );
}
