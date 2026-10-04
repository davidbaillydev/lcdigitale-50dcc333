import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { listRestaurants } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import chickenImage from "@/assets/food-chicken.jpg";
import sushiImage from "@/assets/food-sushi.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LC Digitale — Nos restaurants, commande en ligne" },
      { name: "description", content: "LC Digitale : choisissez votre restaurant et commandez en ligne, à emporter ou en livraison." },
      { property: "og:title", content: "LC Digitale — Nos restaurants" },
      { property: "og:description", content: "Commandez en ligne dans les restaurants du réseau LC Digitale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => listRestaurants(),
  errorComponent: () => <p className="p-10 text-center">Impossible de charger les restaurants.</p>,
  component: Home,
});

function Home() {
  const restaurants = Route.useLoaderData();
  return (
    <div className="restaurant-directory min-h-screen bg-background px-6 py-8 text-foreground sm:px-12 md:py-12">
      <main className="mx-auto max-w-5xl">
        <div className="mb-8 flex justify-end"><ThemeToggle /></div>
        <header className="mb-12 flex flex-col justify-between gap-5 border-b border-border pb-8 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-display text-sm font-bold text-primary">LC Digitale</p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Nos restaurants</h1>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Choisissez votre restaurant et commandez en ligne, à emporter ou en livraison.</p>
        </header>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {restaurants.map((r) => {
            const image = r.slug === "woknsushi" ? sushiImage : r.name.toLowerCase().includes("miami") ? chickenImage : null;
            return (
              <article key={r.id} className="directory-card group flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                <Link to="/$slug" params={{ slug: r.slug }} aria-label={`Commander chez ${r.name}`} className="block h-48 overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  {image ? <img src={image} alt={r.slug === "woknsushi" ? "Sushis — visuel illustratif" : "Poulet croustillant — visuel illustratif"} className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transition-none" /> : r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-full w-full object-contain p-8" /> : <div className="flex h-full items-center justify-center font-display text-3xl font-bold text-muted-foreground">{r.name}</div>}
                </Link>
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <h2 className="font-display text-2xl font-bold leading-tight">{r.name}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />{r.city}</p>
                  {r.config.tagline && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{r.config.tagline}</p>}
                  <div className="mt-auto grid grid-cols-1 gap-3 pt-8 sm:grid-cols-2">
                    <Button asChild className="h-12 rounded-md text-base font-semibold"><Link to="/$slug" params={{ slug: r.slug }}>Commander</Link></Button>
                    <Button asChild variant="outline" className="h-12 rounded-md px-3 text-sm font-semibold"><Link to="/connexion">Espace restaurant</Link></Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {restaurants.length === 0 && <p className="py-12 text-center text-muted-foreground">Aucun restaurant disponible pour le moment.</p>}
        <footer className="mt-12 text-center text-xs text-muted-foreground">LC Digitale</footer>
      </main>
    </div>
  );
}
