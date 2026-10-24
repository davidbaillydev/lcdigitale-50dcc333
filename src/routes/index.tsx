import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Search, Store, ShieldCheck, ChefHat, Bike, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { listRestaurants } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => ({
    meta: [
      { title: "LC Digitale — Les établissements partenaires" },
      { name: "description", content: "LC Digitale : choisissez votre restaurant et commandez en ligne, à emporter ou en livraison." },
      { property: "og:title", content: "LC Digitale — Les établissements partenaires" },
      { property: "og:description", content: "Commandez en ligne dans les restaurants du réseau LC Digitale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(loaderData?.find((r) => r.brand?.coverUrl?.startsWith("https://"))?.brand?.coverUrl
        ? [
            { property: "og:image", content: loaderData.find((r) => r.brand?.coverUrl)?.brand?.coverUrl ?? "" },
            { name: "twitter:image", content: loaderData.find((r) => r.brand?.coverUrl)?.brand?.coverUrl ?? "" },
          ] : []),
    ],
  }),
  loader: () => listRestaurants(),
  errorComponent: () => <p className="p-10 text-center">Impossible de charger les restaurants.</p>,
  component: Home,
});

function Home() {
  const restaurants = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("fr");
  const shown = restaurants.filter((r) => `${r.name} ${r.city}`.toLocaleLowerCase("fr").includes(query));
  const cover = restaurants.find((r) => r.brand?.coverUrl)?.brand?.coverUrl;
  return (
    <div className="restaurant-directory foodcourt-directory min-h-screen bg-background text-foreground">
      <div className="foodcourt-shell">
        <nav aria-label="Navigation principale" className="flex items-center justify-between gap-3 py-6">
          <Link to="/" className="font-display text-xl font-bold">LC Digitale<span className="text-primary">.</span></Link>
          <div className="flex items-center gap-2"><span className="hidden text-sm text-muted-foreground sm:block">Les établissements partenaires</span><ThemeToggle /></div>
        </nav>
        <header className={`foodcourt-welcome relative overflow-hidden ${cover ? "has-cover" : ""}`}>
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="foodcourt-welcome-content relative">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><UtensilsCrossed className="h-4 w-4" /> À emporter · En livraison · À votre table</p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Nos restaurants<span className="text-primary">.</span></h1>
            <p className="mt-3 text-lg">Une envie ? Bon appétit !</p>
          </div>
        </header>
        <div className="foodcourt-layout">
          <main className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">Choisissez votre restaurant <span className="ml-1 text-sm font-normal text-muted-foreground">({shown.length})</span></h2>
              <div className="relative w-full sm:w-64"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un restaurant ou une ville" placeholder="Restaurant, ville…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 bg-card pl-9" /></div>
            </div>
            <div className="foodcourt-grid">
              {shown.map((r) => (
                <article key={r.id} className="foodcourt-tile group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
                  <Link to="/$slug" params={{ slug: r.slug }} aria-label={`Voir la carte de ${r.name}`} className="foodcourt-brand flex items-center justify-center bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    {r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-24 w-36 object-contain" /> : r.brand?.coverUrl ? <img src={r.brand.coverUrl} alt={`Photo de ${r.name}`} className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" /> : <Store aria-hidden="true" className="h-12 w-12 text-primary" />}
                  </Link>
                  <div className="flex flex-1 flex-col items-center px-4 pb-4 pt-5 text-center">
                    <h3 className="font-display text-xl font-semibold leading-tight">{r.name}</h3>
                    <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />{r.city}</p>
                    {r.config.tagline && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.config.tagline}</p>}
                    <Button asChild variant="outline" className="mt-5 min-h-11 w-full text-primary"><Link to="/$slug" params={{ slug: r.slug }}>Voir la carte <ArrowUpRight aria-hidden="true" /></Link></Button>
                  </div>
                </article>
              ))}
            </div>
            {!shown.length && <p className="py-12 text-center text-muted-foreground">{restaurants.length ? "Aucun restaurant ne correspond à votre recherche." : "Aucun restaurant disponible pour le moment."}</p>}
          </main>
          <aside className="foodcourt-pro" aria-label="Accès professionnels">
            <p className="mb-3 font-display text-sm font-semibold text-muted-foreground">Espaces professionnels</p>
            <nav className="foodcourt-pro-links" aria-label="Connexion aux espaces professionnels">
              <Button asChild variant="secondary" className="foodcourt-pro-link"><Link to="/connexion"><Store /><span>Espace restaurant</span><ArrowUpRight /></Link></Button>
              <Button asChild variant="secondary" className="foodcourt-pro-link"><Link to="/connexion"><ShieldCheck /><span>Console agence</span><ArrowUpRight /></Link></Button>
              <Button asChild variant="ghost" className="foodcourt-pro-link"><Link to="/cuisine"><ChefHat /><span>Espace cuisine</span><ArrowUpRight /></Link></Button>
              <Button asChild variant="ghost" className="foodcourt-pro-link"><Link to="/livreur"><Bike /><span>Espace livreur</span><ArrowUpRight /></Link></Button>
            </nav>
          </aside>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground"><span className="font-display font-semibold">LC Digitale.</span><span>Les établissements partenaires</span></footer>
      </div>
    </div>
  );
}
