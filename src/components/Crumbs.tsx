import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";

/** Fil d'Ariane des espaces privés : Accueil (agence ou restaurants) › Restaurant › Page */
export function Crumbs({ slug, page }: { slug?: string; page?: string }) {
  const { isAgency, restaurants } = useStaff();
  const r = slug ? restaurants.find((x) => x.slug === slug) : undefined;
  const sep = <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />;
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {isAgency ? <Link to="/admin" className="hover:text-foreground hover:underline">Console agence</Link>
        : <Link to="/espace" className="hover:text-foreground hover:underline">Mes restaurants</Link>}
      {slug && <>{sep}{isAgency && <><Link to="/admin/$slug" params={{ slug }} className="hover:text-foreground hover:underline">Fiche {r?.name ?? ""}</Link>{sep}</>}
        {page ? <Link to="/espace/$slug" params={{ slug }} className="hover:text-foreground hover:underline">{isAgency ? "Écran cuisine" : r?.name ?? "Restaurant"}</Link>
          : <span className="text-foreground">{isAgency ? "Écran cuisine" : r?.name}</span>}</>}
      {page && <>{sep}<span className="text-foreground">{page}</span></>}
    </nav>
  );
}
