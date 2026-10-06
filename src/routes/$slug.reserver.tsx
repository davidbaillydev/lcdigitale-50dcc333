import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { StripePayment } from "@/components/StripePayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart";
import { euro } from "@/lib/menu";
import { confirmReservation, createReservation, reservationInfo } from "@/lib/reservations.functions";

export const Route = createFileRoute("/$slug/reserver")({
  validateSearch: (s: Record<string, unknown>) => ({ r: typeof s["r"] === "string" ? s["r"] : undefined }),
  head: () => ({
    meta: [
      { title: "Réserver une table — LC Digitale" },
      { name: "description", content: "Réservez votre table en ligne, avec garantie par carte sans débit." },
      { property: "og:title", content: "Réserver une table" },
      { property: "og:description", content: "Réservation en ligne en quelques secondes." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function Page() {
  const { restaurant } = useCart();
  const { r } = Route.useSearch();
  const infoFn = useServerFn(reservationInfo);
  const createFn = useServerFn(createReservation);
  const confirmFn = useServerFn(confirmReservation);
  const info = useQuery({ queryKey: ["reservation-info", restaurant.slug], queryFn: () => infoFn({ data: { slug: restaurant.slug } }), staleTime: 15 * 60_000 });
  const done = useQuery({ queryKey: ["reservation", r], queryFn: () => confirmFn({ data: { id: r! } }), enabled: !!r, retry: false });
  const [f, setF] = useState({ customer_name: "", phone: "", email: "", party_size: 2, date: "", time: "20:00", notes: "" });
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ id: string; clientSecret: string } | null>(null);
  useEffect(() => { setF((x) => ({ ...x, date: new Date().toISOString().slice(0, 10) })); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "party_size" ? Number(e.target.value) : e.target.value });

  const submit = async () => {
    setBusy(true);
    try {
      const starts_at = new Date(`${f.date}T${f.time}`).toISOString();
      const res = await createFn({ data: { slug: restaurant.slug, customer_name: f.customer_name, phone: f.phone, email: f.email, party_size: f.party_size, starts_at, notes: f.notes } });
      if (res.clientSecret) setCard({ id: res.id, clientSecret: res.clientSecret });
      else window.location.assign(`/${restaurant.slug}/reserver?r=${res.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Réservation impossible"); }
    finally { setBusy(false); }
  };

  const body = () => {
    if (r) {
      if (done.isLoading) return <Skeleton className="h-40 w-full" />;
      if (done.error || !done.data) return <p className="text-destructive">Réservation introuvable.</p>;
      const d = done.data;
      return d.status === "confirmed" ? (
        <div className="rounded-xl border border-primary bg-primary/10 p-6 text-center">
          <CalendarCheck className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-2 text-3xl">Table réservée</h2>
          <p className="mt-2">{d.customer_name}, {d.party_size} pers. — {fmt(d.starts_at)}</p>
          {d.no_show_fee > 0 && <p className="mt-2 text-sm text-muted-foreground">Carte enregistrée, aucun débit. {euro(d.no_show_fee)} seront prélevés seulement en cas d'absence non annulée.</p>}
          <Button asChild className="mt-4"><Link to="/$slug" params={{ slug: restaurant.slug }}>Voir la carte</Link></Button>
        </div>
      ) : <p className="rounded-xl border border-border p-4">L'enregistrement de la carte n'a pas abouti. <Link to="/$slug/reserver" params={{ slug: restaurant.slug }} search={{ r: undefined }} className="underline">Recommencer</Link></p>;
    }
    if (info.isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>;
    if (!info.data?.enabled) return <p className="text-muted-foreground">Ce restaurant ne prend pas de réservations en ligne{restaurant.phone ? ` — appelez le ${restaurant.phone}` : ""}.</p>;
    if (card && info.data.publishableKey) return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg bg-card p-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> Empreinte bancaire : rien n'est débité maintenant. {euro(info.data.noShowFee)} seulement en cas d'absence.</p>
        <StripePayment setup publishableKey={info.data.publishableKey} clientSecret={card.clientSecret} label="Garantir ma réservation"
          returnUrl={`${window.location.origin}/${restaurant.slug}/reserver?r=${card.id}`} onCancel={() => setCard(null)} />
      </div>
    );
    const ok = f.customer_name.trim().length > 1 && f.phone.trim().length >= 8 && f.date && f.time;
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="d">Date</Label><Input id="d" type="date" value={f.date} onChange={set("date")} /></div>
          <div><Label htmlFor="t">Heure</Label><Input id="t" type="time" step={900} value={f.time} onChange={set("time")} /></div>
          <div><Label htmlFor="ps">Couverts</Label><Input id="ps" type="number" min={1} max={info.data.maxParty} value={f.party_size} onChange={set("party_size")} /></div>
          <div className="sm:col-span-2"><Label htmlFor="n">Nom *</Label><Input id="n" maxLength={80} value={f.customer_name} onChange={set("customer_name")} /></div>
          <div><Label htmlFor="p">Téléphone *</Label><Input id="p" type="tel" maxLength={20} value={f.phone} onChange={set("phone")} /></div>
          <div className="sm:col-span-3"><Label htmlFor="e">Email</Label><Input id="e" type="email" maxLength={255} value={f.email} onChange={set("email")} /></div>
          <div className="sm:col-span-3"><Label htmlFor="no">Remarques</Label><Textarea id="no" maxLength={500} value={f.notes} onChange={set("notes")} /></div>
        </div>
        {info.data.cardRequired && <p className="text-sm text-muted-foreground">Une carte bancaire sera demandée en garantie, sans débit. Frais de non-présentation : {euro(info.data.noShowFee)}.</p>}
        <Button size="lg" className="w-full" disabled={!ok || busy} onClick={submit}>{busy ? "Envoi…" : info.data.cardRequired ? "Continuer vers la garantie" : "Réserver"}</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader hideCart />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-4xl">Réserver chez {restaurant.name}</h1>
        {body()}
      </main>
    </div>
  );
}
