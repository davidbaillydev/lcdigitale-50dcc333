import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { listRestaurants } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";

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
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-16">
      <div className="flex justify-end"><ThemeToggle /></div>
      <p className="inline-block -rotate-1 brush px-4 py-1 font-display text-xl">LC Digitale · Commande en ligne</p>
      <h1 className="mt-3 text-6xl leading-none sm:text-7xl">Nos restaurants</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {restaurants.map((r) => (
          <Link key={r.id} to="/$slug" params={{ slug: r.slug }} className="rounded-xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary">
            <h2 className="text-4xl">{r.name}</h2>
            {r.config.tagline && <p className="mt-1 text-muted-foreground">{r.config.tagline}</p>}
            <p className="mt-4 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />{r.city}</p>
            <span className="mt-4 inline-block font-semibold text-primary">Commander →</span>
          </Link>
        ))}
      </div>
      <p className="mt-12 text-sm text-muted-foreground"><Link to="/connexion" className="underline">Espace restaurant</Link></p>
    </div>
  );
}
