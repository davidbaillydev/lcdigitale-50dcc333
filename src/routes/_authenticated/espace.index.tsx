import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight, LogOut, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { BrandLogo } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/espace/")({
  head: () => ({
    meta: [
      { title: "Espace restaurants — LC Digitale" },
      { name: "description", content: "Accès aux écrans cuisine de vos restaurants." },
      { property: "og:title", content: "Espace restaurants" },
      { property: "og:description", content: "Choisissez un établissement." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Picker,
});

const ROLE = { agency: "Agence", manager: "Gérant", kitchen: "Cuisine" } as const;

function Picker() {
  const { loading, user, restaurants, isAgency } = useStaff();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/connexion" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!loading && !isAgency && restaurants.length === 1) navigate({ to: "/espace/$slug", params: { slug: restaurants[0]!.slug }, replace: true });
  }, [loading, isAgency, restaurants, navigate]);

  if (loading || !user) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!restaurants.length)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-4xl">Accès en attente</h1>
        <p className="mt-2 text-muted-foreground">Votre compte ({user.email}) doit être rattaché à un restaurant par son gérant ou par l'agence.</p>
        <Button className="mt-6" variant="secondary" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
      </div>
    );
  return (
    <div className="restaurant-picker">
      <header className="workspace-poster bg-primary text-primary-foreground">
        <div className="workspace-inner">
          <div className="flex items-center justify-between gap-4 text-sm font-semibold"><span>LC Digitale / Restaurants</span><ArrowUpRight aria-hidden="true" className="h-8 w-8 shrink-0" /></div>
          <h1 className="workspace-title">Vos restaurants<span aria-hidden="true">.</span></h1>
          <p className="border-t border-primary-foreground/30 pt-4 text-sm">{restaurants.length} établissement{restaurants.length > 1 ? "s" : ""} · {isAgency ? "Agence" : "Votre espace"}</p>
        </div>
      </header>
      <div className="workspace-inner workspace-selection">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
        <h2 className="mr-auto text-2xl">Mes établissements</h2>
        {restaurants.some((r) => r.role !== "kitchen") && <Button asChild variant="secondary"><Link to="/espace/tableau-de-bord">Tableau de bord</Link></Button>}
        {restaurants.some((r) => r.role !== "kitchen") && <Button asChild variant="secondary"><Link to="/espace/factures">Factures</Link></Button>}
        {isAgency && <Button asChild variant="secondary"><Link to="/admin">Console agence</Link></Button>}
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="text-foreground" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {restaurants.map((r, index) => (
          <Link key={r.id} to="/espace/$slug" params={{ slug: r.slug }} className="workspace-establishment group min-w-0 border-b border-border py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="mb-6 flex items-center justify-between gap-3"><span className="font-display text-lg font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span><BrandLogo src={r.logo_url} name={r.name} className="h-14 w-14 object-contain" /></div>
            <p className="workspace-establishment-name break-words font-display font-semibold">{r.name}</p>
            <div className="mt-5 flex items-center justify-between gap-3"><p className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />{r.city} · {ROLE[r.role]}</p><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform motion-safe:group-hover:-translate-y-1"><ArrowUpRight aria-hidden="true" /></span></div>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
