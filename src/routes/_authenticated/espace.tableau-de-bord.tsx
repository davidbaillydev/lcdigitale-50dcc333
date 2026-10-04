import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { downloadCSV, downloadPDF, downloadXLSX, eur } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/espace/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord des ventes — LC Digitale" },
      { name: "description", content: "Chiffre d'affaires, commandes et plats les plus vendus par restaurant et par période." },
      { property: "og:title", content: "Tableau de bord des ventes" },
      { property: "og:description", content: "Indicateurs de ventes et exports." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Order = { id: string; order_number: number; restaurant_id: string; created_at: string; status: string; mode: string; source: string; payment_method: string; payment_ref: string | null; subtotal: number; discount: number; delivery_fee: number; total: number; customer_name: string; items: { name: string; qty: number; total: number }[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS = [["today", "Aujourd'hui"], ["7", "7 jours"], ["30", "30 jours"], ["month", "Ce mois"], ["year", "Cette année"]] as const;
const MODE: Record<string, string> = { pickup: "À emporter", delivery: "Livraison", dine_in: "Sur place" };
const PAY: Record<string, string> = { online: "En ligne", on_site: "Sur place", counter: "Comptoir", card_terminal: "Terminal carte" };
const STATUS: Record<string, string> = { new: "Nouvelle", accepted: "Acceptée", ready: "Prête", done: "Terminée", cancelled: "Annulée" };

function range(p: string): [string, string] {
  const now = new Date(), t = iso(now);
  if (p === "today") return [t, t];
  if (p === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), t];
  if (p === "year") return [`${now.getFullYear()}-01-01`, t];
  return [iso(new Date(Date.now() - (Number(p) - 1) * 864e5)), t];
}

async function fetchOrders(ids: string[], from: string, to: string) {
  const all: Order[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supabase.from("orders")
      .select("id, order_number, restaurant_id, created_at, status, mode, source, payment_method, payment_ref, subtotal, discount, delivery_fee, total, customer_name, items")
      .in("restaurant_id", ids).neq("status", "awaiting_payment")
      .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`)
      .order("created_at").range(i, i + 999);
    if (error) throw error;
    all.push(...((data ?? []) as unknown as Order[]));
    if (!data || data.length < 1000) return all;
  }
}

function Dashboard() {
  const { loading, restaurants } = useStaff();
  const managed = restaurants.filter((r) => r.role !== "kitchen");
  const [rid, setRid] = useState("all");
  const [preset, setPreset] = useState("30");
  const [[from, to], setRange] = useState(() => range("30"));
  const ids = rid === "all" ? managed.map((r) => r.id) : [rid];
  const { data: orders, error, isFetching } = useQuery({
    queryKey: ["dashboard", ids.join(), from, to], enabled: ids.length > 0, queryFn: () => fetchOrders(ids, from, to),
  });

  const s = useMemo(() => {
    const list = orders ?? [];
    const ok = list.filter((o) => o.status !== "cancelled");
    const sum = (a: Order[], f: (o: Order) => number) => Math.round(a.reduce((t, o) => t + Number(f(o)), 0) * 100) / 100;
    const group = (f: (o: Order) => string) => {
      const m = new Map<string, { n: number; ca: number }>();
      ok.forEach((o) => { const k = f(o); const g = m.get(k) ?? { n: 0, ca: 0 }; g.n++; g.ca += Number(o.total); m.set(k, g); });
      return [...m.entries()].sort((a, b) => b[1].ca - a[1].ca);
    };
    const items = new Map<string, { qty: number; ca: number }>();
    ok.forEach((o) => (o.items ?? []).forEach((i) => { const g = items.get(i.name) ?? { qty: 0, ca: 0 }; g.qty += i.qty; g.ca += Number(i.total); items.set(i.name, g); }));
    const days = new Map<string, { n: number; ca: number }>();
    ok.forEach((o) => { const k = o.created_at.slice(0, 10); const g = days.get(k) ?? { n: 0, ca: 0 }; g.n++; g.ca += Number(o.total); days.set(k, g); });
    const ca = sum(ok, (o) => o.total);
    return {
      ok, all: list, ca, n: ok.length, avg: ok.length ? ca / ok.length : 0, discount: sum(ok, (o) => o.discount), fees: sum(ok, (o) => o.delivery_fee),
      cancelled: list.length - ok.length,
      byMode: group((o) => MODE[o.mode] ?? o.mode), bySource: group((o) => (o.source === "kiosk" ? "Borne" : "Site web")), byPay: group((o) => PAY[o.payment_method] ?? o.payment_method),
      byRestaurant: group((o) => managed.find((r) => r.id === o.restaurant_id)?.name ?? "—"),
      top: [...items.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 15), days: [...days.entries()].sort(),
    };
  }, [orders, managed]);

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!managed.length) return <p className="p-10 text-center">Réservé aux gérants et à l'agence.</p>;

  const label = rid === "all" ? "Tous les restaurants" : managed.find((r) => r.id === rid)?.name ?? "";
  const fname = `ventes-${rid === "all" ? "reseau" : managed.find((r) => r.id === rid)?.slug}-${from}_${to}`;
  const g2rows = (g: [string, { n: number; ca: number }][], col: string) => g.map(([k, v]) => ({ [col]: k, Commandes: v.n, "CA (€)": Math.round(v.ca * 100) / 100 }));
  const summary = [{ Indicateur: "Chiffre d'affaires TTC (€)", Valeur: s.ca }, { Indicateur: "Commandes", Valeur: s.n }, { Indicateur: "Panier moyen (€)", Valeur: Math.round(s.avg * 100) / 100 }, { Indicateur: "Remises (€)", Valeur: s.discount }, { Indicateur: "Frais de livraison (€)", Valeur: s.fees }, { Indicateur: "Commandes annulées", Valeur: s.cancelled }];
  const orderRows = () => s.all.map((o) => ({ "N°": o.order_number, Date: new Date(o.created_at).toLocaleString("fr-FR"), Restaurant: managed.find((r) => r.id === o.restaurant_id)?.name ?? "", Client: o.customer_name, Mode: MODE[o.mode] ?? o.mode, Canal: o.source === "kiosk" ? "Borne" : "Site", Paiement: PAY[o.payment_method] ?? o.payment_method, Statut: STATUS[o.status] ?? o.status, "Sous-total": Number(o.subtotal), Remise: Number(o.discount), Livraison: Number(o.delivery_fee), Total: Number(o.total) }));
  const topRows = s.top.map(([k, v]) => ({ Plat: k, Quantité: v.qty, "CA (€)": Math.round(v.ca * 100) / 100 }));
  const max = Math.max(1, ...s.days.map(([, v]) => v.ca));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost"><Link to="/espace"><ArrowLeft /> Mes restaurants</Link></Button>
        <span className="mr-auto" /><ThemeToggle />
      </div>
      <h1 className="text-5xl">Tableau de bord</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="space-y-1 text-sm">Restaurant
          <select value={rid} onChange={(e) => setRid(e.target.value)} className="block h-9 rounded-md border border-input bg-background px-2">
            {managed.length > 1 && <option value="all">Tous les restaurants</option>}
            {managed.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(([k, l]) => <Button key={k} size="sm" variant={preset === k ? "default" : "secondary"} onClick={() => { setPreset(k); setRange(range(k)); }}>{l}</Button>)}
        </div>
        <label className="text-sm">Du<Input type="date" value={from} max={to} onChange={(e) => { setPreset(""); setRange([e.target.value, to]); }} /></label>
        <label className="text-sm">Au<Input type="date" value={to} min={from} onChange={(e) => { setPreset(""); setRange([from, e.target.value]); }} /></label>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" disabled={!orders} onClick={() => downloadCSV(fname, orderRows())}><FileDown /> CSV</Button>
          <Button size="sm" variant="secondary" disabled={!orders} onClick={() => downloadXLSX(fname, { Synthèse: summary, Commandes: orderRows(), "Top plats": topRows, "Par jour": s.days.map(([d, v]) => ({ Jour: d, Commandes: v.n, "CA (€)": Math.round(v.ca * 100) / 100 })) })}><FileSpreadsheet /> Excel</Button>
          <Button size="sm" variant="secondary" disabled={!orders} onClick={() => downloadPDF(fname, `Rapport des ventes — ${label}`, `Période du ${from} au ${to}`, [
            { heading: "Synthèse", rows: summary.map((r) => ({ ...r, Valeur: String(r.Valeur) })) },
            { heading: "Par mode", rows: g2rows(s.byMode, "Mode") }, { heading: "Par canal", rows: g2rows(s.bySource, "Canal") },
            { heading: "Par paiement", rows: g2rows(s.byPay, "Paiement") }, { heading: "Plats les plus vendus", rows: topRows },
          ])}><FileText /> PDF</Button>
        </div>
      </div>

      {error && <p className="text-destructive">{(error as Error).message}</p>}
      <div className={isFetching ? "opacity-60" : ""}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[["Chiffre d'affaires", eur(s.ca)], ["Commandes", s.n], ["Panier moyen", eur(s.avg)], ["Remises", eur(s.discount)], ["Frais livraison", eur(s.fees)], ["Annulées", s.cancelled]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-3xl">{v}</p></div>
          ))}
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-2xl">Chiffre d'affaires par jour</h2>
          {!s.days.length ? <p className="mt-2 text-muted-foreground">Aucune commande sur la période.</p> : (
            <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto">
              {s.days.map(([d, v]) => (
                <div key={d} className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1" title={`${d} : ${eur(v.ca)} · ${v.n} cmd`}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(v.ca / max) * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{d.slice(8)}/{d.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rid === "all" && managed.length > 1 && <Breakdown title="Par restaurant" rows={s.byRestaurant} total={s.ca} />}
          <Breakdown title="Par mode" rows={s.byMode} total={s.ca} />
          <Breakdown title="Par canal" rows={s.bySource} total={s.ca} />
          <Breakdown title="Par paiement" rows={s.byPay} total={s.ca} />
          <section className="rounded-xl border border-border bg-card p-4 md:col-span-2">
            <h2 className="text-2xl">Plats les plus vendus</h2>
            <table className="mt-2 w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th>Plat</th><th className="text-right">Qté</th><th className="text-right">CA</th></tr></thead>
              <tbody>{s.top.map(([k, v]) => <tr key={k} className="border-t border-border"><td className="py-1">{k}</td><td className="text-right">{v.qty}</td><td className="text-right">{eur(v.ca)}</td></tr>)}</tbody></table>
          </section>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, { n: number; ca: number }][]; total: number }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-2 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-sm"><span>{k} · {v.n} cmd</span><span>{eur(v.ca)}</span></div>
            <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${total ? (v.ca / total) * 100 : 0}%` }} /></div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">—</p>}
      </div>
    </section>
  );
}
