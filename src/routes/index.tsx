import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowRight, MapPin, Search, Store, ShieldCheck, ChefHat, Bike, UtensilsCrossed, LogIn } from "lucide-react";
import { useState } from "react";
import { listRestaurants } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const cover = loaderData?.find((r) => r.brand?.coverUrl)?.brand?.coverUrl;
    return {
    meta: [
      { title: "LC Digitale — Les établissements partenaires" },
      { name: "description", content: "LC Digitale : choisissez votre restaurant et commandez en ligne, à emporter ou en livraison." },
      { property: "og:title", content: "LC Digitale — Les établissements partenaires" },
      { property: "og:description", content: "Commandez en ligne dans les restaurants du réseau LC Digitale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(cover?.startsWith("https://")
        ? [
            { property: "og:image", content: cover },
            { name: "twitter:image", content: cover },
          ] : []),
    ],
    };
  },
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
        <nav aria-label="Navigation principale" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5 sm:flex sm:justify-between">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-xl font-bold"><span className="truncate">LC Digitale<span className="text-primary">.</span></span><span className="directory-french-flag shrink-0" role="img" aria-label="France"><span /><span /><span /></span></Link>
          <div className="flex shrink-0 items-center gap-2"><Button asChild variant="ghost" className="h-11 gap-2 px-2 sm:px-3"><a href="#espaces-professionnels"><LogIn aria-hidden="true" /><span>Accès pro</span></a></Button><ThemeToggle /></div>
        </nav>
        <header className={`foodcourt-welcome relative overflow-hidden ${cover ? "has-cover" : ""}`}>
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="foodcourt-welcome-content relative">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><UtensilsCrossed className="h-4 w-4 shrink-0" /> Les établissements partenaires</p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">Nos restaurants<span className="text-primary">.</span></h1>
            <p className="mt-4 text-lg">Une envie ? Bon appétit !</p>
            <p className="mt-2 text-sm">À emporter · En livraison · À votre table</p>
          </div>
        </header>
        <div className="foodcourt-layout">
          <main className="min-w-0">
            <div className="mb-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
              <h2 className="min-w-0 font-display text-2xl font-semibold">À découvrir <span className="ml-1 text-sm font-normal text-muted-foreground">({shown.length})</span></h2>
              <div className="relative min-w-0"><Search aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un restaurant ou une ville" placeholder="Restaurant, ville…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 bg-card pl-9" /></div>
            </div>
            <div className="foodcourt-grid">
              {shown.map((r) => (
                <article key={r.id} className="foodcourt-tile group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
                  <Link to="/$slug" params={{ slug: r.slug }} aria-label={`Voir la carte de ${r.name}`} className="foodcourt-brand relative flex items-center justify-center overflow-hidden bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    {r.brand?.coverUrl ? <img src={r.brand.coverUrl} alt={`Photo de ${r.name}`} className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" /> : r.logo_url ? <img src={r.logo_url} alt={r.name} className="foodcourt-logo h-28 w-44 object-contain" /> : <Store aria-hidden="true" className="h-12 w-12 text-primary" />}
                    {r.brand?.coverUrl && r.logo_url && <span className="foodcourt-logo-stamp"><img src={r.logo_url} alt="" className="h-full w-full object-contain" /></span>}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 pt-5">
                    <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{r.city}</p>
                    <h3 className="font-display text-2xl font-semibold leading-tight">{r.name}</h3>
                    {r.config.tagline && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.config.tagline}</p>}
                    <div className="mt-auto pt-5"><Button asChild className="min-h-12 w-full justify-between"><Link to="/$slug" params={{ slug: r.slug }}>Voir la carte <ArrowRight aria-hidden="true" /></Link></Button></div>
                  </div>
                </article>
              ))}
            </div>
            {!shown.length && <p className="py-12 text-center text-muted-foreground">{restaurants.length ? "Aucun restaurant ne correspond à votre recherche." : "Aucun restaurant disponible pour le moment."}</p>}
          </main>
          <aside id="espaces-professionnels" className="foodcourt-pro" aria-label="Accès professionnels">
            <div className="foodcourt-pro-heading"><LogIn aria-hidden="true" className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-semibold">Espaces professionnels</h2></div>
            <nav className="foodcourt-pro-links" aria-label="Connexion aux espaces professionnels">
              <Button asChild variant="outline" className="foodcourt-pro-link"><Link to="/connexion"><span className="foodcourt-pro-icon"><Store aria-hidden="true" /></span><span>Espace restaurant</span><ArrowUpRight aria-hidden="true" /></Link></Button>
              <Button asChild variant="outline" className="foodcourt-pro-link"><Link to="/connexion"><span className="foodcourt-pro-icon"><ShieldCheck aria-hidden="true" /></span><span>Console agence</span><ArrowUpRight aria-hidden="true" /></Link></Button>
              <Button asChild variant="outline" className="foodcourt-pro-link"><Link to="/cuisine"><span className="foodcourt-pro-icon"><ChefHat aria-hidden="true" /></span><span>Espace cuisine</span><ArrowUpRight aria-hidden="true" /></Link></Button>
              <Button asChild variant="outline" className="foodcourt-pro-link"><Link to="/livreur"><span className="foodcourt-pro-icon"><Bike aria-hidden="true" /></span><span>Espace livreur</span><ArrowUpRight aria-hidden="true" /></Link></Button>
            </nav>
          </aside>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground"><span className="font-display font-semibold">LC Digitale.</span><span>Les établissements partenaires</span></footer>
      </div>
    </div>
  );
}
