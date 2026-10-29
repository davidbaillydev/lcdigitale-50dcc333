import { UpsellPanel } from "@/components/UpsellPanel";
import { CustomDomainPanel } from "@/components/CustomDomainPanel";
import { FeaturesPanel } from "@/components/FeaturesPanel";
import { Crumbs } from "@/components/Crumbs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChefHat, ExternalLink, Tablet, Users, UtensilsCrossed } from "lucide-react";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { getAgencyPublicDomain } from "@/lib/agency.functions";
import { RestaurantSettingsForm } from "@/components/RestaurantSettingsForm";
import { MarketingPanel } from "@/components/MarketingPanel";
import { PaymentProvidersPanel } from "@/components/PaymentProvidersPanel";
import { PaymentModulesPanel, paymentModulesOf } from "@/components/PaymentModulesPanel";
import { VapiWebPanel } from "@/components/VapiWebPanel";
import { VoiceChannelPanel } from "@/components/VoiceChannelPanel";
import { LegalPanel } from "@/components/LegalPanel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { BrandLogo } from "@/lib/brand";
import { SettingsGroup, SettingsWorkspace } from "@/components/SettingsWorkspace";
import { MenuTemplatePanel } from "@/components/MenuTemplatePanel";
import { WhatsAppAccess } from "@/components/WhatsAppAccess";

export const Route = createFileRoute("/_authenticated/admin/$slug")({
  head: () => ({
    meta: [
      { title: "Fiche restaurant — Console LC Digitale" },
      { name: "description", content: "Configuration complète d'un restaurant partenaire." },
      { property: "og:title", content: "Fiche restaurant" },
      { property: "og:description", content: "Configuration d'un restaurant." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const load = useServerFn(loadRestaurantAdmin);
  const loadDomain = useServerFn(getAgencyPublicDomain);
  const { data: r, error, refetch } = useQuery({ queryKey: ["restaurant-admin", slug], queryFn: () => load({ data: { slug } }), retry: false });
  const { data: publicDomain } = useQuery({ queryKey: ["agency-public-domain"], queryFn: () => loadDomain(), retry: false, staleTime: 60_000 });
  const steps = r ? [
    ["Identité & marque", !!(r.address && r.phone)],
    ["Horaires", Object.values(r.opening ?? {}).some((x) => x.length)],
    ["Commandes & livraison", !!r.config?.modes || (r.delivery?.zones?.length ?? 0) > 0],
    ["Carte", !!r.menu || !!r.menu_key],
  ] as const : [];
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex items-center justify-between"><Crumbs /><ThemeToggle /></div>
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {r && (
        <>
          <div className="flex items-center gap-4">
            <BrandLogo src={r.logo_url} name={r.name} className="h-16 w-16 rounded-lg object-contain" />
            <div><h1 className="text-5xl">{r.name}</h1><p className="text-muted-foreground">/{r.slug} · {r.active ? "En ligne" : "Hors ligne"}</p></div>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {steps.map(([l, ok], i) => (
              <li key={l} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span className={ok ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex h-6 w-6 items-center justify-center rounded-full border border-border"}>{ok ? <Check className="h-4 w-4" /> : i + 1}</span>{l}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/espace/$slug/carte" params={{ slug }}><UtensilsCrossed /> Carte & import</Link></Button>
            <Button asChild variant="secondary"><Link to="/espace/$slug/equipe" params={{ slug }}><Users /> Équipe & invitations</Link></Button>
            <Button asChild variant="secondary"><Link to="/espace/$slug" params={{ slug }}><ChefHat /> Cuisine</Link></Button>
            <Button asChild variant="secondary"><a href={`/${slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Site</a></Button>
            <Button asChild variant="secondary"><a href={`/${slug}/borne`} target="_blank" rel="noreferrer"><Tablet /> Borne</a></Button>
            <WhatsAppAccess restaurant={r} origin={publicDomain} />
          </div>
          <p className="text-sm text-muted-foreground">Identité, logo et couleurs se modifient depuis la console (bouton « Modifier »).</p>
          <MenuTemplatePanel restaurantId={r.id} name={r.name} />
           <SettingsWorkspace agency>
             <RestaurantSettingsForm restaurant={r} onSaved={() => refetch()} />
             <SettingsGroup name="payments">
               <PaymentModulesPanel key={`pm-${r.id}`} restaurantId={r.id} initial={r.config} onSaved={() => refetch()} />
               <PaymentProvidersPanel restaurantId={r.id} modules={paymentModulesOf(r.config)} />
             </SettingsGroup>
             <SettingsGroup name="communication">
               <UpsellPanel key={`u-${r.id}`} restaurant={r} onSaved={() => refetch()} />
               <MarketingPanel restaurantId={r.id} marketing={r.config.marketing} onSaved={() => refetch()} />
             </SettingsGroup>
             <SettingsGroup name="integrations">
               <CustomDomainPanel key={`d-${r.id}`} restaurantId={r.id} initial={(r.config as { customDomains?: string[] }).customDomains} onSaved={() => refetch()} />
               <VoiceChannelPanel restaurantId={r.id} />
               <VapiWebPanel key={r.id} restaurant={r} onSaved={() => refetch()} />
             </SettingsGroup>
             <SettingsGroup name="agency">
               <FeaturesPanel restaurantId={r.id} initial={r.enabled_features} onSaved={() => refetch()} />
               <LegalPanel key={`legal-${r.id}-${r.legal?.updatedAt ?? ""}`} restaurant={r} onSaved={() => refetch()} />
             </SettingsGroup>
           </SettingsWorkspace>
        </>
      )}
    </div>
  );
}
