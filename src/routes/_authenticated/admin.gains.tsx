import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Crumbs } from "@/components/Crumbs";
import { ThemeToggle } from "@/lib/theme";
import { getAgencyGains } from "@/lib/agency-gains.functions";

export const Route = createFileRoute("/_authenticated/admin/gains")({
  head: () => ({
    meta: [
      { title: "Gains agence — Console agence" },
      { name: "description", content: "Frais de service encaissés par restaurant sur la période." },
      { property: "og:title", content: "Gains agence — Console agence" },
      { property: "og:description", content: "Vue agence des frais de service." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function range(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(now) };
}

const PERIODS = [
  { key: "7", label: "7 jours", get: () => range(7) },
  { key: "30", label: "30 jours", get: () => range(30) },
  { key: "90", label: "90 jours", get: () => range(90) },
  { key: "month", label: "Mois en cours", get: monthRange },
];

function Page() {
  const [period, setPeriod] = useState("30");
  const { from, to } = useMemo(() => PERIODS.find((p) => p.key === period)!.get(), [period]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["agency-gains", from, to],
    queryFn: () => getAgencyGains({ data: { from, to } }),
  });

  const maxDay = Math.max(1, ...(data?.byDay ?? []).map((d) => d.serviceFees));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-2"><Crumbs page="Gains agence" /><span className="mr-auto" /><ThemeToggle /></div>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-5xl">Gains agence</h1>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`h-11 rounded-md border px-4 text-sm font-medium ${period === p.key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Frais de service encaissés sur les commandes validées (hors commandes annulées ou en attente de paiement), du {from} au {to}.
        Les frais sont encaissés sur le compte de paiement de chaque restaurant avec sa commande.
      </p>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Frais de service</p>
              <p className="mt-1 text-4xl font-semibold">{fmt(data.serviceFees)}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Commandes validées</p>
              <p className="mt-1 text-4xl font-semibold">{data.orders}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
              <p className="mt-1 text-4xl font-semibold">{fmt(data.revenue)}</p>
            </div>
          </div>

          {data.byDay.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-xl">Frais de service par jour</h2>
              <div className="mt-4 flex h-40 items-end gap-1" aria-label="Graphique des frais de service par jour">
                {data.byDay.map((d) => (
                  <div key={d.day} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${Math.max(2, Math.round((d.serviceFees / maxDay) * 140))}px` }}
                    />
                    <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-xs text-background group-hover:block">
                      {d.day.slice(5)} · {fmt(d.serviceFees)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <h2 className="border-b p-5 text-xl">Par restaurant</h2>
            {data.perRestaurant.length === 0 ? (
              <p className="p-5 text-muted-foreground">Aucune commande avec frais de service sur cette période.</p>
            ) : (
              <ul className="divide-y">
                {data.perRestaurant.map((r) => (
                  <li key={r.restaurantId} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="mr-auto min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.orders} commande{r.orders > 1 ? "s" : ""} · CA {fmt(r.revenue)}</p>
                    </div>
                    <p className="text-xl font-semibold">{fmt(r.serviceFees)}</p>
                    {r.slug && (
                      <Link to="/admin/$slug" params={{ slug: r.slug }} className="text-sm text-primary hover:underline">
                        Fiche
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
