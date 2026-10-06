import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, MapPin, Bike, ShoppingBag, Phone } from "lucide-react";
import { RestaurantBanner } from "@/components/RestaurantBanner";
import { getRestaurant } from "@/lib/restaurants.functions";
import { euro, type MenuItem } from "@/lib/menu";
import { ItemDialog } from "@/components/ItemDialog";
import { SiteHeader } from "@/components/SiteHeader";
import { VapiVoiceWidget } from "@/components/VapiVoiceWidget";
import { LegalFooter } from "@/components/LegalFooter";
import { useConsent } from "@/lib/consent";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { menuImage } from "@/lib/menu-images";
import { AllergenBadges, AllergenPicker } from "@/components/Allergens";
import { safeFor } from "@/lib/allergens";
import { useTable } from "@/lib/table";
import { catLabel, itemText, LANG_LABELS, UI, useMenuLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/$slug/")({
  loader: ({ params }) => getRestaurant({ data: { slug: params.slug } }),
  head: ({ loaderData: r }) => ({ meta: [
    { title: `Carte & commande | ${r?.name ?? "LC Digitale"}` },
    { name: "description", content: `Découvrez la carte de ${r?.name ?? "votre restaurant"} et commandez en ligne.` },
    { property: "og:title", content: `Carte & commande | ${r?.name ?? "LC Digitale"}` },
    { property: "og:description", content: `Commandez chez ${r?.name ?? "votre restaurant"}, à emporter ou en livraison.` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MenuPage,
});

function MenuPage() {
  const [open, setOpen] = useState<MenuItem | null>(null);
  const { count, subtotal, restaurant, catalog, qr } = useCart();
  const { consent } = useConsent();
  const view = qr.view;
  const [excluded, setExcluded] = useState<string[]>([]);
  const shown = catalog.categories.map((c) => ({ ...c, items: c.items.filter((i) => safeFor(i, excluded)) })).filter((c) => c.items.length);
  const d = restaurant.delivery;
  const [lang, setLang] = useMenuLang();
  const ui = UI[lang];
  const table = useTable(restaurant.slug, restaurant.config.qr?.tables ?? 0);

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader hideCart={view} />
      {table && <p className="bg-primary px-4 py-2 text-center font-semibold text-primary-foreground" role="status">Table {table} · commandez ici, nous vous servons à table</p>}
      {!table && qr.room && <p className="bg-primary px-4 py-2 text-center font-semibold text-primary-foreground" role="status">Room service · Chambre {qr.room}</p>}
      {!table && qr.self && <p className="bg-primary px-4 py-2 text-center font-semibold text-primary-foreground" role="status">Libre-service · votre commande sera validée par notre équipe</p>}
      {view && <p className="bg-secondary px-4 py-2 text-center text-sm font-semibold text-secondary-foreground" role="status">Menu en consultation · commandes sur place auprès de notre équipe</p>}
      <section className="relative overflow-hidden">
        <RestaurantBanner restaurant={restaurant} />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-2 inline-block -rotate-1 brush px-4 py-1 font-display text-xl">{restaurant.city}</p>
          <h1 className="max-w-xl break-words text-6xl leading-none sm:text-8xl">{restaurant.name}</h1>
          {restaurant.config.tagline && <p className="mt-3 max-w-md">{restaurant.config.tagline}</p>}
          <p className="mt-4 max-w-md text-muted-foreground">Commandez en ligne, récupérez sur place ou faites-vous livrer.</p>
          {restaurant.vapi_phone_number && (
            <a href={`tel:${restaurant.vapi_phone_number.replace(/[^\d+]/g, "")}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              <Phone className="h-4 w-4" /> Disponible par téléphone 24/7 avec notre assistant IA Kaito · {restaurant.vapi_phone_number}
            </a>
          )}
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><ShoppingBag className="h-4 w-4 text-primary" /> À emporter dès {restaurant.config.lead?.pickup ?? 20} min</span>
            {d.zones.length > 0 && (
              <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Bike className="h-4 w-4 text-primary" /> Livraison · {euro(d.fee)} (offerte dès {d.freeFrom} €)</span>
            )}
            {restaurant.config.hoursLabel && <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5"><Clock className="h-4 w-4 text-primary" /> {restaurant.config.hoursLabel}</span>}
          </div>
        </div>
      </section>

      <nav className="sticky top-[61px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          <div className="flex shrink-0 overflow-hidden rounded-full border border-border" role="group" aria-label="Langue de la carte">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-2.5 py-1.5 text-xs font-bold ${lang === l ? "bg-primary text-primary-foreground" : "hover:text-primary"}`}>{LANG_LABELS[l]}</button>)}
          </div>
          {shown.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">{catLabel(c, lang)}</a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <details className="rounded-xl border border-border bg-card p-4" open={excluded.length > 0}>
          <summary className="cursor-pointer font-semibold">{ui.allergies} {excluded.length > 0 && <span className="text-primary">({excluded.length} exclu{excluded.length > 1 ? "s" : ""})</span>}</summary>
          <div className="mt-3"><AllergenPicker value={excluded} onChange={setExcluded} /></div>
          {excluded.length > 0 && <button className="mt-2 text-sm underline" onClick={() => setExcluded([])}>Tout réafficher</button>}
          <p className="mt-2 text-xs text-muted-foreground">Les plats dont les allergènes ne sont pas renseignés sont aussi masqués. Informations déclarées par le restaurant. En cas d'allergie sévère, contactez-le avant de commander.</p>
        </details>
        {!catalog.categories.length && <p className="py-10 text-center text-muted-foreground">{ui.soon}</p>}
        {excluded.length > 0 && !shown.length && <p className="py-10 text-center text-muted-foreground">Aucun plat sans ces allergènes.</p>}
        {shown.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-32">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <h2 className="inline-block -rotate-1 brush px-5 py-1 text-4xl">{catLabel(c, lang)}</h2>
              {menuImage(c.id) && <img src={menuImage(c.id)} alt={`Illustration de la catégorie ${c.label}`} loading="lazy" width={1024} height={768} className="h-24 w-32 shrink-0 rounded-md object-cover sm:h-32 sm:w-48" />}
            </div>
            {c.note && <p className="mt-3 text-sm text-muted-foreground">{c.note}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.items.map((i) => (
                <button key={i.id} onClick={() => !view && setOpen(i)} disabled={view}
                  className={`group flex flex-col overflow-hidden rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary ${i.builder ? "border-primary/60 sm:col-span-2 lg:col-span-1" : "border-border"}`}>
                  {i.image && <img src={i.image} alt={i.name} loading="lazy" className="-mx-4 -mt-4 mb-3 aspect-[16/10] w-[calc(100%+2rem)] max-w-none object-cover transition group-hover:scale-[1.02]" />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-2xl leading-tight">{itemText(i, lang).name}</h3>
                    <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">{euro(i.price)}</span>
                  </div>
                  {itemText(i, lang).desc && <p className="mt-1 text-sm text-muted-foreground">{itemText(i, lang).desc}</p>}
                  <AllergenBadges ids={i.allergens} className="mt-2" />
                  {!view && <span className="mt-auto pt-3 text-sm font-semibold text-primary opacity-80 group-hover:opacity-100">
                    {i.builder ? ui.compose : i.options?.length ? ui.options : ui.add}
                  </span>}
                </button>
              ))}
            </div>
          </section>
        ))}
        <footer className="space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" /> {restaurant.name}
            {restaurant.address ? ` · ${restaurant.address}` : ""} · {restaurant.city}
          </p>
          {restaurant.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" /> <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="underline">{restaurant.phone}</a>
              {restaurant.email && <> · <a href={`mailto:${restaurant.email}`} className="underline">{restaurant.email}</a></>}
            </p>
          )}
          {restaurant.config.hoursLabel && (
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" /> {restaurant.config.hoursLabel}</p>
          )}
          <p><Link to="/connexion" className="underline">Espace restaurant</Link></p>
          <LegalFooter slug={restaurant.slug} />
        </footer>
      </main>

      {count > 0 && !view && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button asChild size="lg" className="w-full font-semibold">
            <Link to="/$slug/commande" params={{ slug: restaurant.slug }}>Commander · {count} article{count > 1 ? "s" : ""} · {euro(subtotal)}</Link>
          </Button>
        </div>
      )}
      {consent?.voice && <VapiVoiceWidget restaurant={restaurant} />}
      <ItemDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
