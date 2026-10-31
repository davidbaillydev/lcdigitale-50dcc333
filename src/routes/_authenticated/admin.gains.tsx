import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { getAgencyGains } from "@/lib/agency-gains.functions";
import { modeEnabled, onlinePaymentEnabled, paymentEnabled, type Restaurant } from "@/lib/shop";
import { serviceFeeDefaults } from "@/lib/service-fee";
import { platformFeeDefaults, PLATFORM_FEE_CHANNELS } from "@/lib/platform-fee";

export const Route = createFileRoute("/_authenticated/admin/gains")({
  head: () => ({ meta: [
    { title: "Gains, paiements et frais — LC Digitale" },
    { name: "description", content: "Montants par restaurant, frais client, commissions Mollie, remboursements et règles de paiement." },
    { property: "og:title", content: "Gains, paiements et frais — LC Digitale" },
    { property: "og:description", content: "Suivi agence des paiements, commissions et soldes estimés par restaurant." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: Page,
});
const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const dateLabel = (d: string) => new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
function range(days: number) {
  const to = new Date(), from = new Date(); from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
const PERIODS = [{ key: "7", label: "7 jours" }, { key: "30", label: "30 jours" }, { key: "90", label: "90 jours" }, { key: "month", label: "Mois en cours" }];
const channelLabel = (key?: string) => PLATFORM_FEE_CHANNELS.find(([c]) => c === key)?.[1] ?? "Autre";
const statusLabel = (key?: string) => ({ paid: "Payée", pending: "En attente", unpaid: "Non réglée", failed: "Échec", expired: "Expirée", refunded: "Remboursée", partially_refunded: "Remboursement partiel" })[key ?? ""] ?? "Non confirmé";
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0 rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>;
}
function Rules({ config }: { config: Restaurant["config"] & { platformFee?: unknown } }) {
  const r = { config } as Restaurant, service = serviceFeeDefaults(config.serviceFee), commission = platformFeeDefaults(config.platformFee);
  return <div className="grid gap-6 py-5 lg:grid-cols-2">
    <div><h3 className="mb-3 font-semibold">Modes et paiements · réglages actuels</h3><dl className="space-y-3 text-sm">
      {(["pickup", "delivery", "dine_in"] as const).map((mode) => <div key={mode} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3"><dt className="text-muted-foreground">{channelLabel(mode)}</dt><dd>{!modeEnabled(r, mode) ? "Désactivé" : [onlinePaymentEnabled(r, mode) ? "En ligne" : "", mode !== "delivery" && paymentEnabled(r, "on_site") ? "En mains propres" : ""].filter(Boolean).join(" + ") || "Aucun paiement autorisé"}{modeEnabled(r, mode) && mode === "delivery" && " obligatoire avant livraison"}</dd></div>)}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3"><dt className="text-muted-foreground">Borne</dt><dd>{config.kiosk?.cardOnly ? "CB terminal uniquement (Voie B)" : [paymentEnabled(r, "counter") ? "Comptoir" : "", paymentEnabled(r, "card_terminal") ? "CB terminal" : "", config.payments?.qr === true ? "QR en ligne" : ""].filter(Boolean).join(" + ") || "Aucun paiement autorisé"}</dd></div>
    </dl><p className="mt-3 text-xs text-muted-foreground">Autorisation configurée ; disponibilité du prestataire et du terminal non vérifiée ici.</p></div>
    <div><h3 className="mb-3 font-semibold">Frais client et commission · réglages actuels</h3><dl className="space-y-3 text-sm">
      <div><dt className="text-muted-foreground">Frais de service client</dt><dd className="mt-1">{!service.enabled ? "Désactivés" : service.kind === "fixed" ? `${fmt(service.value)} par commande` : `${service.value.toLocaleString("fr-FR")} % du sous-total`}{service.enabled && ` · ${PLATFORM_FEE_CHANNELS.filter(([c]) => service.modes[c]).map(([, label]) => label).join(", ") || "Aucun canal"}`}</dd></div>
      <div><dt className="text-muted-foreground">Commission plateforme Mollie</dt><dd className="mt-1">7 % du total TTC · {PLATFORM_FEE_CHANNELS.filter(([c]) => commission.modes[c]).map(([, label]) => label).join(", ") || "Aucun canal"}</dd></div>
    </dl><p className="mt-3 text-xs text-muted-foreground">Commission appliquée aux paiements Mollie Connect éligibles, pas aux simples clés API ni au TPE. Les frais client sont inclus dans le montant du restaurant, pas un gain agence supplémentaire.</p></div>
  </div>;
}
function Page() {
  const [period, setPeriod] = useState("30"), [restaurant, setRestaurant] = useState("all"), [page, setPage] = useState(0);
  const { from, to } = useMemo(() => { const dates = range(Number(period) || 30); return period === "month" ? { ...dates, from: `${dates.to.slice(0, 7)}-01` } : dates; }, [period]);
  const fetchGains = useServerFn(getAgencyGains);
  const { data, isLoading, error, isFetching, refetch } = useQuery({ queryKey: ["agency-gains", from, to], queryFn: () => fetchGains({ data: { from, to } }) });
  const selected = data?.restaurants.find((r) => r.restaurantId === restaurant);
  const totals = selected ?? data?.details;
  const transactions = (data?.transactions ?? []).filter((o) => restaurant === "all" || o.restaurant_id === restaurant);
  const restaurants = (data?.restaurants ?? []).filter((r) => restaurant === "all" || r.restaurantId === restaurant);
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <div className="flex items-center gap-2"><Crumbs page="Gains agence" /><span className="mr-auto" /><ThemeToggle /></div>
    <header className="flex flex-wrap items-end gap-4"><div className="mr-auto"><h1 className="text-4xl sm:text-5xl">Gains agence</h1><p className="mt-2 text-muted-foreground">Paiements, frais et répartition des montants</p></div><Button variant="outline" className="h-12" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? "animate-spin" : ""} />Actualiser</Button></header>
    <div className="flex flex-wrap items-end gap-4 border-y py-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Période">{PERIODS.map((p) => <Button key={p.key} variant={period === p.key ? "default" : "outline"} aria-pressed={period === p.key} className="h-12" onClick={() => { setPeriod(p.key); setPage(0); }}>{p.label}</Button>)}</div><label className="min-w-0 flex-1 text-sm sm:max-w-xs">Restaurant<select aria-label="Restaurant" className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-foreground" value={restaurant} onChange={(e) => { setRestaurant(e.target.value); setPage(0); }}><option value="all">Tous les restaurants</option>{data?.restaurants.map((r) => <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>)}</select></label></div>
    <p className="text-sm text-muted-foreground">Commandes créées du {dateLabel(`${from}T12:00:00Z`)} au {dateLabel(`${to}T12:00:00Z`)} (bornes UTC). Commandes test, annulées et en attente de paiement exclues. Les montants payés suivent l’état de règlement enregistré.</p>
    {isLoading && <p role="status">Chargement des montants…</p>}{error && <p role="alert" className="text-destructive">{error instanceof Error ? error.message : "Impossible de charger les montants."}</p>}
    {totals && <>
      <section aria-label="Montants de la période" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Commission agence Mollie enregistrée" value={fmt(totals.platformFees)} note="Sur paiements réglés ; reversement bancaire non confirmé." />
        <Metric label="Frais client sur commandes réglées" value={fmt(totals.paidServiceFees)} note="Inclus dans le total restaurant, distincts de la commission agence." />
        <Metric label="Total des commandes réglées" value={fmt(totals.paid)} note={`${totals.paidOrders} réglées / ${totals.orders} commandes validées · avant remboursements.`} />
        <Metric label="Solde restaurant estimé" value={fmt(totals.restaurantBalanceEstimate)} note="Total réglé − remboursements − commission ; hors frais prestataire." />
      </section>
      <section className="border-y py-5"><h2 className="text-2xl">Remboursements et autres montants</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Remboursements enregistrés", fmt(totals.refunds)], ["Règlement non confirmé", fmt(totals.unpaid)], ["Frais de livraison facturés", fmt(totals.deliveryFees)], ["Remises accordées", fmt(totals.discounts)]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-muted-foreground">Livraison et remises : toutes les commandes validées. Frais client facturés : {fmt(totals.serviceFees)}. Les remboursements ne permettent pas d’isoler la part de frais client ou de commission restituée.</p></section>
      <aside className="border-l-4 border-primary bg-muted/40 p-4 text-sm"><h2 className="font-semibold">Sommes reversées : non disponibles</h2><p className="mt-2 text-muted-foreground">Aucun relevé de versement bancaire n’est enregistré ici. La commission Mollie est le montant sauvegardé avec le paiement, pas une preuve de réception par l’agence. Le solde restaurant est une estimation avant frais du prestataire et ajustements ; il ne correspond pas à un virement confirmé.</p></aside>
      <section><h2 className="text-2xl">Détail par restaurant</h2><div className="mt-4 divide-y border-y">{restaurants.map((r) => <details key={r.restaurantId} className="group py-4"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-3"><ChevronRight className="size-5 shrink-0 group-open:rotate-90" /><div className="mr-auto min-w-0"><h3 className="break-words text-lg font-semibold">{r.name}</h3><p className="text-sm text-muted-foreground">{r.active ? "Actif" : "Désactivé"} · {r.orders} commandes · {r.paidOrders} réglées</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Commission agence</p><p className="text-xl font-semibold tabular-nums">{fmt(r.platformFees)}</p></div></summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Total réglé", r.paid], ["Frais client réglés", r.paidServiceFees], ["Remboursements", r.refunds], ["Solde estimé hors frais prestataire", r.restaurantBalanceEstimate]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{fmt(Number(value))}</p></div>)}</div><Rules config={r.config} /><h4 className="font-semibold">Activité par canal</h4><div className="my-3 flex flex-wrap gap-4 text-sm">{r.channels.length ? r.channels.map((c) => <p key={c.channel}>{channelLabel(c.channel)} · {c.orders} commandes · {fmt(c.total)}</p>) : <p className="text-muted-foreground">Aucune commande sur cette période.</p>}</div><Button asChild variant="outline" className="h-12"><Link to="/admin/$slug" params={{ slug: r.slug }}>Fiche restaurant<ChevronRight /></Link></Button></details>)}</div></section>
      <section><h2 className="text-2xl">Paiements et frais par commande</h2><p className="mt-1 text-sm text-muted-foreground">Montants historiques sauvegardés, indépendants des réglages actuels.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr>{["Commande / restaurant", "Canal / paiement", "État", "Total", "Frais client", "Commission", "Remboursé"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{transactions.slice(page * 20, (page + 1) * 20).map((o) => <tr key={o.id}><td className="px-3 py-3"><p className="font-medium">#{o.order_number} · {o.name}</p><p className="text-xs text-muted-foreground">{dateLabel(o.created_at)}</p></td><td className="px-3 py-3"><p>{channelLabel(o.source === "kiosk" ? "kiosk" : o.mode)}</p><p className="text-xs text-muted-foreground">{o.payment_method === "on_site" || o.payment_method === "counter" ? "En mains propres" : o.provider}</p></td><td className="whitespace-nowrap px-3 py-3">{statusLabel(o.payment_status)}</td>{[o.total, o.service_fee, o.platform_fee, o.refunded_amount].map((v, i) => <td key={i} className="whitespace-nowrap px-3 py-3 tabular-nums">{fmt(Number(v ?? 0))}</td>)}</tr>)}</tbody></table>{!transactions.length && <p className="py-6 text-muted-foreground">Aucune commande sur cette période.</p>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{transactions.length} commandes · Page {page + 1} / {Math.max(1, Math.ceil(transactions.length / 20))}</p><div className="flex gap-2"><Button variant="outline" className="h-12" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button><Button variant="outline" className="h-12" disabled={(page + 1) * 20 >= transactions.length} onClick={() => setPage(page + 1)}>Suivant</Button></div></div></section>
    </>}
  </div>;
}
