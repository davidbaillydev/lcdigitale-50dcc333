import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, MapPin, Bike, ShoppingBag } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { CATEGORIES, euro, type MenuItem } from "@/lib/menu";
import { DELIVERY } from "@/lib/shop";
import { ItemDialog } from "@/components/ItemDialog";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wok & Sushi Colomiers — Commandez en ligne" },
      { name: "description", content: "Woks signatures, compose ton wok, sushis, plateaux, pokés et ramens. Click & collect ou livraison à Colomiers." },
      { property: "og:title", content: "Wok & Sushi Colomiers — Commandez en ligne" },
      { property: "og:description", content: "Woks, sushis et pokés à emporter ou en livraison autour de Colomiers." },
    ],
  }),
  component: MenuPage,
});

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
        <Link to="/" className="truncate font-display text-3xl">
          Wok <span className="text-primary">&amp;</span> Sushi
        </Link>
        <CartSheet />
      </div>
    </header>
  );
}

function MenuPage() {
  const [open, setOpen] = useState<MenuItem | null>(null);
  const { count, subtotal } = useCart();

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader />
      <section className="relative overflow-hidden">
        <img src={hero} alt="Wok de nouilles et plateau de sushis" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover object-right opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-2 inline-block -rotate-1 brush px-4 py-1 font-display text-xl">Colomiers</p>
          <h1 className="max-w-xl text-6xl leading-none sm:text-8xl">Woks &amp; sushis faits minute</h1>
          <p className="mt-4 max-w-md text-muted-foreground">Commandez en ligne, récupérez sur place ou faites-vous livrer dans un rayon de 5 km.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><ShoppingBag className="h-4 w-4 text-primary" /> À emporter dès 20 min</span>
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Bike className="h-4 w-4 text-primary" /> Livraison ~40 min · {euro(DELIVERY.fee)} (offerte dès {DELIVERY.freeFrom} €)</span>
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Clock className="h-4 w-4 text-primary" /> 11h30–14h30 · 18h–22h30</span>
          </div>
        </div>
      </section>

      <nav className="sticky top-[61px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
              {c.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {CATEGORIES.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-32">
            <h2 className="inline-block -rotate-1 brush px-5 py-1 text-4xl">{c.label}</h2>
            {c.note && <p className="mt-3 text-sm text-muted-foreground">{c.note}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setOpen(i)}
                  className={`group flex flex-col rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary ${i.builder ? "border-primary/60 sm:col-span-2 lg:col-span-1" : "border-border"}`}
                >
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
        <footer className="flex items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" /> Wok &amp; Sushi · Colomiers ·{" "}
          <Link to="/connexion" className="underline">Espace restaurant</Link>
        </footer>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button asChild size="lg" className="w-full font-semibold">
            <Link to="/commande">Commander · {count} article{count > 1 ? "s" : ""} · {euro(subtotal)}</Link>
          </Button>
        </div>
      )}
      <ItemDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
