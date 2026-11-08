import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, ChefHat, Globe, LogOut, MapPin, Search, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, type StaffRestaurant } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/lib/theme";
import { BrandLogo } from "@/lib/brand";
import { automaticRestaurant } from "@/lib/last-restaurant";
import { useKitchenCounts, ZERO_COUNTS, type KitchenCounts } from "@/components/KitchenOverview";
import { CountryFlag } from "@/components/CountryFlag";
import { countryOf } from "@/lib/country";

export const Route = createFileRoute("/_authenticated/espace/")({
  head: () => ({
    meta: [
      { title: "Espace restaurants — LC Digitale" },
      { name: "description", content: "Hub des cuisines : commandes en direct et accès rapide à chaque restaurant." },
      { property: "og:title", content: "Espace restaurants" },
      { property: "og:description", content: "Toutes vos cuisines en un coup d'œil." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Hub,
});

const ROLE = { agency: "Agence", manager: "Gérant", kitchen: "Cuisine" } as const;
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function Hub() {
  const { loading, user, restaurants, isAgency } = useStaff();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const counts = useKitchenCounts(restaurants);
  useEffect(() => { if (!loading && !user) navigate({ to: "/connexion" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (loading || !user) return;
    const chosen = automaticRestaurant(restaurants, isAgency);
    if (chosen) navigate({ to: "/espace/$slug", params: { slug: chosen.slug }, replace: true });
  }, [loading, user, isAgency, restaurants, navigate]);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return q ? restaurants.filter((r) => norm(`${r.name} ${r.city ?? ""} ${r.slug}`).includes(q)) : restaurants;
  }, [restaurants, query]);

  if (loading || !user) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!restaurants.length)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-4xl">Accès en attente</h1>
        <p className="mt-2 text-muted-foreground">Votre compte ({user.email}) doit être rattaché à un restaurant par son gérant ou par l'agence.</p>
        <Button className="mt-6" variant="secondary" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
      </div>
    );

  const canStats = restaurants.some((r) => r.role !== "kitchen" && (r.role === "agency" || r.features.facturx));
  const totals = Object.values(counts).reduce((a, c) => ({ fresh: a.fresh + c.fresh, cooking: a.cooking + c.cooking, ready: a.ready + c.ready }), ZERO_COUNTS);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <div className="mr-auto min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-primary">LC Digitale{[...new Set(restaurants.map(countryOf))].map((country) => <CountryFlag key={country} country={country} />)}</p>
            <h1 className="font-display text-xl font-semibold leading-tight">Espace restaurants</h1>
          </div>
          {canStats && <Button asChild variant="ghost" size="sm"><Link to="/espace/tableau-de-bord"><BarChart3 /> <span className="hidden sm:inline">Ventes & statistiques</span></Link></Button>}
          {isAgency && <Button asChild variant="ghost" size="sm"><Link to="/admin"><ShieldCheck /> <span className="hidden sm:inline">Console agence</span></Link></Button>}
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl">Cuisines en direct</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {restaurants.length} établissement{restaurants.length > 1 ? "s" : ""} · {totals.fresh} nouvelle{totals.fresh > 1 ? "s" : ""} · {totals.cooking} en préparation · {totals.ready} prête{totals.ready > 1 ? "s" : ""}
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un établissement…" aria-label="Rechercher un établissement" className="h-11 pl-9" />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">Aucun établissement ne correspond à « {query} ».</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((r) => <RestaurantCard key={r.id} r={r} c={counts[r.id] ?? ZERO_COUNTS} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function RestaurantCard({ r, c }: { r: StaffRestaurant; c: KitchenCounts }) {
  const online = r.active !== false;
  const total = c.fresh + c.cooking + c.ready;
  const canManage = r.role !== "kitchen";
  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <BrandLogo src={r.logo_url} name={r.name} className="h-14 w-14 shrink-0 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-lg font-semibold leading-tight"><CountryFlag country={countryOf(r)} /><span className="min-w-0 break-words">{r.name}</span></p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{r.city ?? "—"} · {ROLE[r.role]}</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? "bg-primary" : "bg-muted-foreground"}`} />
            {online ? "En ligne" : "Hors ligne"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Counter label="Nouvelles" value={c.fresh} strong />
        <Counter label="En préparation" value={c.cooking} />
        <Counter label="Prêtes" value={c.ready} />
      </div>

      <Button asChild size="lg" className="mt-5 h-12 w-full text-base">
        <Link to="/espace/$slug" params={{ slug: r.slug }} aria-label={`Ouvrir la cuisine de ${r.name}`}>
          <ChefHat /> Ouvrir la cuisine{total > 0 ? ` (${total})` : ""}
        </Link>
      </Button>

      <div className="mt-3 flex flex-wrap gap-1">
        {online && <Button asChild variant="ghost" size="sm"><a href={`/${r.slug}`}><Globe /> Site</a></Button>}
        {canManage && <Button asChild variant="ghost" size="sm"><Link to="/espace/$slug/carte" params={{ slug: r.slug }}><BookOpen /> Carte</Link></Button>}
        {canManage && <Button asChild variant="ghost" size="sm"><Link to="/espace/$slug/reglages" params={{ slug: r.slug }}><Settings /> Réglages</Link></Button>}
      </div>
    </li>
  );
}

function Counter({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const hot = strong && value > 0;
  return (
    <div className={`rounded-lg px-2 py-3 ${hot ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`text-xs ${hot ? "" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}
