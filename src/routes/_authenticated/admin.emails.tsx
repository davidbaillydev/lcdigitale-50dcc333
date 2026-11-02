import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { campaignHtml, orderConfirmedHtml, orderReceivedHtml, refundHtml, restaurantNewOrderHtml, type EmailOrder, type EmailRestaurant } from "@/lib/email-templates";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({ meta: [
    { title: "Aperçu des e-mails — LC Digitale" },
    { name: "description", content: "Prévisualisation des e-mails de commande, remboursement et campagne aux couleurs de chaque restaurant." },
    { property: "og:title", content: "Aperçu des e-mails — LC Digitale" },
    { property: "og:description", content: "Vérifier le rendu des e-mails avant tout envoi réel." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: Page,
});

const BASE = "https://restaurant.lcdigitale.fr";
const TEMPLATES = [
  ["received", "Commande reçue (client)"],
  ["confirmed", "Commande confirmée (client)"],
  ["restaurant", "Nouvelle commande (restaurant)"],
  ["refund", "Remboursement (client)"],
  ["campaign", "Campagne marketing"],
] as const;
type Key = (typeof TEMPLATES)[number][0];

/** Données fictives : aucune commande réelle n'est lue, rien n'est envoyé. */
const sampleOrder = (mode: string): EmailOrder => ({
  id: "apercu", order_number: 1042, mode, slot: new Date(Date.now() + 45 * 60_000).toISOString(), asap: false, total: 32.5,
  items: [
    { name: "Menu Tacos XL", qty: 1, total: 16.5, size: "XL", details: ["Viande : Poulet, Kefta", "Sauces : Blanche, Algérienne"] },
    { name: "Frites maison", qty: 2, total: 7 },
    { name: "Coca-Cola 33 cl", qty: 3, total: 9 },
  ],
  notes: "Sans oignons s'il vous plaît", email: "marie.dupont@exemple.fr", phone: "06 12 34 56 78",
  customer_name: "Marie Dupont", first_name: "Marie", last_name: "Dupont",
  address: "12 rue des Lilas", postal_code: "31770", city: "Colomiers", table_label: null, payment_status: "paid",
});

function Page() {
  const { data: restaurants = [] } = useQuery({
    queryKey: ["email-preview-restaurants"],
    queryFn: async () => (await supabase.from("restaurants").select("slug, name, brand, logo_url, address, city, phone").order("name")).data ?? [],
  });
  const [slug, setSlug] = useState("");
  const [tpl, setTpl] = useState<Key>("received");
  const [mode, setMode] = useState("delivery");
  const [mobile, setMobile] = useState(false);
  const r = (restaurants.find((x) => x.slug === slug) ?? restaurants[0]) as EmailRestaurant | undefined;

  const html = useMemo(() => {
    if (!r) return "";
    const o = sampleOrder(mode);
    switch (tpl) {
      case "received": return orderReceivedHtml(o, r, BASE);
      case "confirmed": return orderConfirmedHtml(o, r, BASE);
      case "restaurant": return restaurantNewOrderHtml(o, r, BASE);
      case "refund": return refundHtml(o, r, BASE, 32.5, "AV-2026-0007");
      case "campaign": return campaignHtml({
        restaurant: r.name, color: r.brand?.accent, subject: "-20 % ce week-end sur tous les menus",
        body: "Ce week-end, profitez de 20 % de réduction sur tous nos menus, en livraison comme à emporter.\nCode : WEEKEND20",
        ctaUrl: `${BASE}/${r.slug}`, ctaLabel: "Commander maintenant",
        brand: { logoUrl: r.logo_url, address: r.address, city: r.city, phone: r.phone },
      }).replace("{{params.name}}", "Marie").replace("{{params.unsub}}", "#");
    }
  }, [r, tpl, mode]);

  return <div className="min-h-screen bg-background">
    <header className="border-b"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Crumbs page="Aperçu des e-mails" />
      <ThemeToggle />
    </div></header>
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Aperçu des e-mails</h1>
          <p className="mt-1 text-sm text-muted-foreground">Exemple fictif : aucune commande réelle, aucun envoi.</p>
        </div>
        <label className="block text-sm font-medium">Restaurant
          <select className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={r?.slug ?? ""} onChange={(e) => setSlug(e.target.value)}>
            {restaurants.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        </label>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Modèle</p>
          {TEMPLATES.map(([k, label]) => <Button key={k} variant={tpl === k ? "default" : "outline"} className="h-11 w-full justify-start" onClick={() => setTpl(k)}>{label}</Button>)}
        </div>
        {tpl !== "campaign" && tpl !== "refund" && <label className="block text-sm font-medium">Mode de commande
          <select className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="delivery">Livraison</option><option value="pickup">À emporter</option><option value="dine_in">Sur place</option>
          </select>
        </label>}
        <div className="flex gap-2">
          <Button variant={mobile ? "outline" : "default"} className="h-11 flex-1" onClick={() => setMobile(false)}><Monitor className="mr-2 h-4 w-4" />Ordinateur</Button>
          <Button variant={mobile ? "default" : "outline"} className="h-11 flex-1" onClick={() => setMobile(true)}><Smartphone className="mr-2 h-4 w-4" />Mobile</Button>
        </div>
        {r && !/^https:\/\//.test(r.logo_url ?? "") && <p className="rounded-md border p-3 text-xs text-muted-foreground">Logo non affiché : il n'est pas hébergé en ligne, les messageries le bloqueraient. Le nom du restaurant est utilisé à la place.</p>}
      </aside>
      <section className="flex justify-center rounded-lg border bg-muted/40 p-4">
        {html
          ? <iframe title="Aperçu de l'e-mail" srcDoc={html} sandbox="" className="h-[900px] rounded-md border bg-card transition-all" style={{ width: mobile ? 375 : "100%", maxWidth: 680 }} />
          : <p className="py-20 text-sm text-muted-foreground">Chargement…</p>}
      </section>
    </main>
  </div>;
}
