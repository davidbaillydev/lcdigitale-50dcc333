import { Link, getRouteApi } from "@tanstack/react-router";
import { buildLegalDoc, DOC_TITLES, type LegalDocKey, type LegalInfo } from "@/lib/legal";
import { SiteHeader } from "@/components/SiteHeader";
import { LegalFooter } from "@/components/LegalFooter";

const slugRoute = getRouteApi("/$slug");

export function LegalPage({ doc }: { doc: LegalDocKey }) {
  const { restaurant } = slugRoute.useLoaderData();
  const sections = buildLegalDoc(restaurant, doc);
  const updated = (restaurant.legal as LegalInfo | undefined)?.updatedAt;
  return (
    <div className="min-h-screen">
      <SiteHeader hideCart />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link to="/$slug" params={{ slug: restaurant.slug }} className="text-sm underline">← Retour à la carte</Link>
        <h1 className="font-display text-5xl">{DOC_TITLES[doc]}</h1>
        <p className="text-sm text-muted-foreground">{restaurant.name} · {updated ? `mis à jour le ${new Date(updated).toLocaleDateString("fr-FR")}` : "version initiale"}</p>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-2xl font-semibold">{s.title}</h2>
            {s.body.map((p) => <p key={p} className="leading-relaxed text-muted-foreground">{p}</p>)}
          </section>
        ))}
        <LegalFooter slug={restaurant.slug} />
      </main>
    </div>
  );
}

export const legalHead = (doc: LegalDocKey) => ({ loaderData, matches }: { loaderData?: unknown; matches: { loaderData?: unknown }[] }) => {
  void loaderData;
  const r = (matches.find((m) => (m.loaderData as { restaurant?: { name: string } } | undefined)?.restaurant)?.loaderData as { restaurant: { name: string } } | undefined)?.restaurant;
  const title = `${DOC_TITLES[doc]} — ${r?.name ?? "Restaurant"}`;
  const desc = `${DOC_TITLES[doc]} du site de commande en ligne ${r?.name ?? ""}.`.trim();
  return { meta: [
    { title }, { name: "description", content: desc },
    { property: "og:title", content: title }, { property: "og:description", content: desc },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] };
};
