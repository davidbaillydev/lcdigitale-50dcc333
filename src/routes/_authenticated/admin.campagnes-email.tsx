import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Mail, ChevronRight } from "lucide-react";
import { Crumbs } from "@/components/Crumbs";
import { ThemeToggle } from "@/lib/theme";
import { listAgencyRestaurants } from "@/lib/agency.functions";

const initial = queryOptions({ queryKey: ["agency-restaurants", "campagnes-email"], queryFn: () => listAgencyRestaurants() });

export const Route = createFileRoute("/_authenticated/admin/campagnes-email")({
  head: () => ({ meta: [
    { title: "Campagnes e-mail — LC Digitale" },
    { name: "description", content: "Campagnes e-mail de la console agence : choisir un restaurant pour préparer et suivre ses envois par vagues." },
    { property: "og:title", content: "Campagnes e-mail — Console agence LC Digitale" },
    { property: "og:description", content: "Accéder aux campagnes e-mail de chaque restaurant." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(initial), component: Page,
});

function Page() {
  useServerFn(listAgencyRestaurants);
  const { data: restaurants } = useSuspenseQuery(initial);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
    <header className="flex items-center justify-between gap-3"><Crumbs page="Campagnes e-mail" /><ThemeToggle /></header>
    <div className="flex items-center gap-3"><Mail className="size-8 text-primary" /><h1 className="text-3xl font-semibold">Campagnes e-mail</h1><span className="ml-auto text-sm text-muted-foreground">Brevo</span></div>
    <p className="text-sm text-muted-foreground">Choisissez un restaurant pour préparer sa campagne e-mail, envoyer un test et lancer les vagues d'envoi depuis sa page Clients.</p>
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {restaurants.map((r) => (
        <Link key={r.id} to="/espace/$slug/clients" params={{ slug: r.slug }} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-sm text-muted-foreground">{r.city ?? "—"} · /{r.slug}</span></span>
          {!r.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
      {!restaurants.length && <p className="px-4 py-6 text-sm text-muted-foreground">Aucun restaurant enregistré.</p>}
    </div>
  </main>;
}
