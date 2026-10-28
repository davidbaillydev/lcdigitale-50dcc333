import { useEffect, type ReactNode } from "react";
import { Link, Navigate, useParams, useRouterState } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useStaff, type StaffRestaurant } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rememberLastRestaurant } from "@/lib/last-restaurant";

type Level = "kitchen" | "manager" | "agency";
const RANK: Record<StaffRestaurant["role"], number> = { kitchen: 0, manager: 1, agency: 2 };
const NEED: Record<Level, number> = { kitchen: 0, manager: 1, agency: 2 };

function Denied({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden />
      <h1 className="text-3xl">Accès non autorisé</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild><Link to="/espace">Mes restaurants</Link></Button>
    </div>
  );
}

const Loading = () => <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-label="Chargement"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

/** Garde des pages restaurant : restaurant inconnu → refus ; rôle insuffisant → retour à l'écran cuisine. */
export function RestaurantGuard({ level, children }: { level: Level; children: ReactNode }) {
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const { loading, user, restaurants } = useStaff();
  const granted = !loading && !!user && !!slug && restaurants.some((x) => x.slug === slug);
  useEffect(() => {
    if (granted && slug) rememberLastRestaurant(slug);
  }, [granted, slug]);
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/connexion" replace />;
  const r = restaurants.find((x) => x.slug === slug);
  if (!r || !slug) return <Denied message="Ce restaurant ne fait pas partie de vos établissements." />;
  if (RANK[r.role] < NEED[level]) return <Navigate to="/espace/$slug" params={{ slug }} replace />;
  return <>{children}</>;
}

/** Garde des pages multi-restaurants (factures, tableau de bord) : interdites aux comptes Cuisine seuls. */
export function ManagerOnlyGuard({ children }: { children: ReactNode }) {
  const { loading, user, restaurants } = useStaff();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/connexion" replace />;
  if (!restaurants.some((r) => r.role !== "kitchen")) {
    const only = restaurants.length === 1 ? restaurants[0] : undefined;
    return only ? <Navigate to="/espace/$slug" params={{ slug: only.slug }} replace /> : <Navigate to="/espace" replace />;
  }
  return <>{children}</>;
}

/** Barre de navigation entre les pages du restaurant, filtrée selon le rôle et les modules. */
export function RestaurantNav({ slug, className }: { slug: string; className?: string }) {
  const { restaurants } = useStaff();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const r = restaurants.find((x) => x.slug === slug);
  if (!r) return null;
  const mgr = r.role !== "kitchen";
  const f = r.features;
  const links: { to: string; label: string; show: boolean }[] = [
    { to: "/espace/$slug", label: "Cuisine", show: true },
    { to: "/espace/$slug/carte", label: "Carte", show: mgr },
    { to: "/espace/$slug/reservations", label: "Réservations", show: f.reservation },
    { to: "/espace/$slug/reglages", label: "Réglages", show: mgr },
    { to: "/espace/$slug/livraison", label: "Livraison", show: mgr && f.livraison },
    { to: "/espace/$slug/qr", label: "QR codes", show: mgr && f.qrcode },
    { to: "/espace/$slug/clients", label: "Clients", show: mgr },
    { to: "/espace/$slug/statistiques", label: "Statistiques", show: mgr },
    { to: "/espace/$slug/equipe", label: "Équipe", show: r.role === "agency" },
  ];
  return (
    <nav aria-label="Pages du restaurant" className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {links.filter((l) => l.show).map((l) => {
        const href = l.to.replace("$slug", slug);
        const active = path.replace(/\/$/, "") === href;
        return (
          <Button key={l.to} asChild size="sm" variant={active ? "default" : "secondary"} className="min-h-11 shrink-0">
            <Link to={l.to} params={{ slug }} aria-current={active ? "page" : undefined}>{l.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}
