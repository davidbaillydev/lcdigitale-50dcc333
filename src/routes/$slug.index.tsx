import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, MapPin, Bike, ShoppingBag } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { euro, type MenuItem } from "@/lib/menu";
import { ItemDialog } from "@/components/ItemDialog";
import { SiteHeader } from "@/components/SiteHeader";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$slug/")({
  component: MenuPage,
});

function MenuPage() {
  const [open, setOpen] = useState<MenuItem | null>(null);
  const { count, subtotal, restaurant, catalog } = useCart();
  const d = restaurant.delivery;

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader />
      <section className="relative overflow-hidden">
        <img src={hero} alt={`Spécialités de ${restaurant.name}`} width={1600} height={912} className="absolute inset-0 h-full w-full object-cover object-right opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-2 inline-block -rotate-1 brush px-4 py-1 font-display text-xl">{restaurant.city}</p>
          <h1 className="max-w-xl text-6xl leading-none sm:text-8xl">{restaurant.config.tagline ?? restaurant.name}</h1>
          <p className="mt-4 max-w-md text-muted-foreground">Commandez en ligne, récupérez sur place ou faites-vous livrer.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><ShoppingBag className="h-4 w-4 text-primary" /> À emporter dès {restaurant.config.lead?.pickup ?? 20} min</span>
            {d.zones.length > 0 && (
              <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Bike className="h-4 w-4 text-primary" /> Livraison · {euro(d.fee)} (offerte dès {d.freeFrom} €)</span>
            )}
            {restaurant.config.hoursLabel && <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Clock className="h-4 w-4 text-primary" /> {restaurant.config.hoursLabel}</span>}
          </div>
        </div>
      </section>

      <nav className="sticky top-[61px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {catalog.categories.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">{c.label}</a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {!catalog.categories.length && <p className="py-10 text-center text-muted-foreground">La carte arrive bientôt.</p>}
        {catalog.categories.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-32">
            <h2 className="inline-block -rotate-1 brush px-5 py-1 text-4xl">{c.label}</h2>
            {c.note && <p className="mt-3 text-sm text-muted-foreground">{c.note}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.items.map((i) => (
                <button key={i.id} onClick={() => setOpen(i)}
                  className={`group flex flex-col rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary ${i.builder ? "border-primary/60 sm:col-span-2 lg:col-span-1" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-2xl leading-tight">{i.name}</h3>
                    <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">{euro(i.price)}</span>
                  </div>
                  {i.desc && <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>}
                  <span className="mt-auto pt-3 text-sm font-semibold text-primary opacity-80 group-hover:opacity-100">
                    {i.builder ? "Composer →" : i.options?.length ? "Choisir les options →" : "+ Ajouter"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <footer className="space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" /> {restaurant.name}
            {restaurant.address ? ` · ${restaurant.address}` : ""} · {restaurant.city}
          </p>
          {restaurant.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" /> <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="underline">{restaurant.phone}</a>
              {restaurant.email && <> · <a href={`mailto:${restaurant.email}`} className="underline">{restaurant.email}</a></>}
            </p>
          )}
          {restaurant.config.hoursLabel && (
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" /> {restaurant.config.hoursLabel}</p>
          )}
          <p><Link to="/connexion" className="underline">Espace restaurant</Link></p>
        </footer>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button asChild size="lg" className="w-full font-semibold">
            <Link to="/$slug/commande" params={{ slug: restaurant.slug }}>Commander · {count} article{count > 1 ? "s" : ""} · {euro(subtotal)}</Link>
          </Button>
        </div>
      )}
      <ItemDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
