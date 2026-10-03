import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cuisine/")({
  head: () => ({
    meta: [
      { title: "Espace restaurants — LC Digitale" },
      { name: "description", content: "Accès aux écrans cuisine de vos restaurants." },
      { property: "og:title", content: "Espace restaurants" },
      { property: "og:description", content: "Choisissez un établissement." },
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
    if (!loading && !isAgency && restaurants.length === 1) navigate({ to: "/cuisine/$slug", params: { slug: restaurants[0]!.slug }, replace: true });
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
      <div className="flex items-center">
        <h1 className="mr-auto text-5xl">Vos restaurants</h1>
        {isAgency && <Button asChild variant="secondary"><Link to="/agence">Console agence</Link></Button>}
        <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {restaurants.map((r) => (
          <Link key={r.id} to="/cuisine/$slug" params={{ slug: r.slug }} className="rounded-xl border border-border bg-card p-5 hover:border-primary">
            <p className="text-3xl">{r.name}</p>
            <p className="text-sm text-muted-foreground">{r.city} · {ROLE[r.role]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
