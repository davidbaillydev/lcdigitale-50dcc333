import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";

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
    <div className="mx-auto max-w-3xl p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <h1 className="col-span-2 min-w-0 text-5xl sm:mr-auto">Vos restaurants</h1>
        {restaurants.some((r) => r.role !== "kitchen") && <Button asChild variant="secondary"><Link to="/espace/tableau-de-bord">Tableau de bord</Link></Button>}
        {isAgency && <Button asChild variant="secondary"><Link to="/admin">Console agence</Link></Button>}
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {restaurants.map((r) => (
          <Link key={r.id} to="/espace/$slug" params={{ slug: r.slug }} className="admin-restaurant-card min-w-0 rounded-lg border border-border bg-card p-4 hover:border-primary sm:p-5">
            <p className="break-words font-display text-2xl font-semibold sm:text-3xl">{r.name}</p>
            <p className="mt-2 break-words text-sm text-muted-foreground">{r.city} · {ROLE[r.role]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
