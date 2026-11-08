import { useRouterState } from "@tanstack/react-router";
import { useStaff } from "@/hooks/use-staff";
import { countryOf } from "@/lib/country";
import { CountryFlag } from "./CountryFlag";

/** Multi-country accounts show their actual countries, not an arbitrary French fallback. */
export function WorkspaceCountryFlag() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { restaurants } = useStaff();
  if (!path.startsWith("/espace")) return null;
  const slug = path.split("/")[2];
  const current = restaurants.find((r) => r.slug === slug);
  const countries = current ? [countryOf(current)] : [...new Set(restaurants.map(countryOf))];
  return <span className="flex flex-wrap items-center gap-2" aria-label="Pays des établissements">{countries.map((country) => <CountryFlag key={country} country={country} />)}</span>;
}