import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, MapPin } from "lucide-react";
import { listRestaurants } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import chickenImage from "@/assets/food-chicken.jpg";
import sushiImage from "@/assets/food-sushi.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LC Digitale — Les établissements partenaires" },
      { name: "description", content: "LC Digitale : choisissez votre restaurant et commandez en ligne, à emporter ou en livraison." },
      { property: "og:title", content: "LC Digitale — Les établissements partenaires" },
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
    <div className="restaurant-directory min-h-screen bg-background text-foreground">
      <nav aria-label="Navigation principale" className="directory-nav flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold">LC<span className="text-primary">.</span></span>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost"><Link to="/connexion">Espace restaurant <ArrowUpRight aria-hidden="true" /></Link></Button>
          <ThemeToggle />
        </div>
      </nav>
      <header className="directory-poster bg-primary text-primary-foreground">
        <div className="directory-poster-inner">
          <div className="flex items-center justify-between gap-4 text-sm font-semibold">
            <span>Les établissements partenaires</span>
            <ArrowDownRight aria-hidden="true" className="h-8 w-8 shrink-0" />
          </div>
          <h1 className="directory-title font-display font-bold">LC Digitale<span aria-hidden="true">.</span></h1>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-primary-foreground/30 pt-5">
            <p className="text-lg font-medium">À emporter. En livraison. À votre table.</p>
            <span className="text-sm">{restaurants.length} établissement{restaurants.length > 1 ? "s" : ""}</span>
          </div>
        </div>
      </header>
      <main className="directory-partners">
        <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-5">
          <h2 className="font-display text-2xl font-semibold">Nos restaurants</h2>
          <span className="text-sm text-muted-foreground">La sélection LC Digitale</span>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          {restaurants.map((r, index) => {
            const image = r.slug === "woknsushi" ? sushiImage : r.name.toLowerCase().includes("miami") ? chickenImage : null;
            return (
              <article key={r.id} className="directory-establishment group flex min-w-0 flex-col">
                <Link to="/$slug" params={{ slug: r.slug }} aria-label={`Commander chez ${r.name}`} className="directory-image relative block overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  {image ? <img src={image} alt={r.slug === "woknsushi" ? "Sushis — visuel illustratif" : "Poulet croustillant — visuel illustratif"} className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transition-none" /> : r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-full w-full object-contain p-8" /> : <div className="flex h-full items-center justify-center font-display text-3xl font-bold text-muted-foreground">{r.name}</div>}
                  <span className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground"><ArrowUpRight aria-hidden="true" /></span>
                </Link>
                <div className="flex flex-1 flex-col py-6">
                  <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                    <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />{r.city}</p>
                    <span className="font-display font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="directory-partner-name font-display font-semibold">{r.name}</h3>
                  {r.config.tagline && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.config.tagline}</p>}
                  <div className="mt-auto flex justify-between gap-3 border-b border-border py-6">
                    <Button asChild className="h-12 rounded-md px-6 text-base font-semibold"><Link to="/$slug" params={{ slug: r.slug }}>Commander <ArrowUpRight aria-hidden="true" /></Link></Button>
                    <Button asChild variant="ghost" className="h-12 rounded-md px-2 text-sm"><Link to="/connexion">Espace restaurant</Link></Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {restaurants.length === 0 && <p className="py-12 text-center text-muted-foreground">Aucun restaurant disponible pour le moment.</p>}
        <footer className="mt-12 flex items-center justify-between gap-4 border-t border-border py-7 text-sm text-muted-foreground"><span className="font-display font-semibold text-foreground">LC Digitale<span className="text-primary">.</span></span><span>Les établissements partenaires</span></footer>
      </main>
    </div>
  );
}
