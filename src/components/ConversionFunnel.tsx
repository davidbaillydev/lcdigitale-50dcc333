import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { euro } from "@/lib/menu";

const ABANDON_MIN = 30;
const STEP_LABEL: Record<string, string> = {
  view_menu: "Consultation de la carte",
  add_to_cart: "Panier rempli, tunnel non ouvert",
  checkout_started: "Tunnel de commande (coordonnées, retrait/livraison)",
  payment_pending: "Paiement en ligne / TPE",
};
const CHANNEL: Record<string, string> = { web: "Site", borne: "Borne", qr_code: "QR code" };
type Item = { id: string; name: string; qty: number; price: number };

/** Tunnel de conversion & paniers abandonnés (lecture protégée par les droits du restaurant). */
export function ConversionFunnel({ restaurantIds, names }: { restaurantIds: string[]; names?: Record<string, string> | undefined }) {
  const [days, setDays] = useState(30);
  const [channel, setChannel] = useState<string>("all");
  const q = useQuery({
    queryKey: ["cart-sessions", restaurantIds.join(","), days],
    enabled: restaurantIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.from("cart_sessions")
        .select("session_id,restaurant_id,channel,current_step,max_step,cart_items,cart_total,exit_page,traffic_source,last_active_at,created_at")
        .in("restaurant_id", restaurantIds).gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return data;
    },
  });

  const s = useMemo(() => {
    const rows = (q.data ?? []).filter((r) => channel === "all" || r.channel === channel);
    const cutoff = Date.now() - ABANDON_MIN * 60_000;
    const n = rows.length;
    const cart = rows.filter((r) => r.max_step >= 1).length;
    const checkout = rows.filter((r) => r.max_step >= 2).length;
    const payment = rows.filter((r) => r.max_step >= 3).length;
    const done = rows.filter((r) => r.current_step === "completed").length;
    const abandoned = rows.filter((r) => r.current_step !== "completed" && r.max_step >= 1 && new Date(r.last_active_at).getTime() < cutoff);
    const byStep = new Map<string, number>();
    const byPage = new Map<string, number>();
    const items = new Map<string, { name: string; qty: number; amount: number; carts: number }>();
    for (const r of abandoned) {
      byStep.set(r.current_step, (byStep.get(r.current_step) ?? 0) + 1);
      const pg = r.exit_page || "Carte"; byPage.set(pg, (byPage.get(pg) ?? 0) + 1);
      for (const it of (r.cart_items as Item[]) ?? []) {
        const e = items.get(it.id) ?? { name: it.name, qty: 0, amount: 0, carts: 0 };
        e.qty += it.qty; e.amount += it.qty * it.price; e.carts += 1; items.set(it.id, e);
      }
    }
    const sources = new Map<string, { visits: number; orders: number }>();
    for (const r of rows) { const k = r.traffic_source || "Accès direct"; const e = sources.get(k) ?? { visits: 0, orders: 0 }; e.visits++; if (r.current_step === "completed") e.orders++; sources.set(k, e); }
    return {
      n, done, abandoned,
      funnel: [["Visiteurs", n], ["Avec panier", cart], ["Tunnel de commande", checkout], ["Au paiement en ligne", payment], ["Commandes validées", done]] as [string, number][],
      lost: abandoned.reduce((t, r) => t + Number(r.cart_total), 0),
      byStep: [...byStep].sort((a, b) => b[1] - a[1]),
      byPage: [...byPage].sort((a, b) => b[1] - a[1]).slice(0, 8),
      items: [...items.values()].sort((a, b) => b.carts - a.carts).slice(0, 15),
      sources: [...sources].sort((a, b) => b[1].visits - a[1].visits).slice(0, 10),
    };
  }, [q.data, channel]);

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10} %` : "—");
  const cartsWithItems = s.funnel[1]![1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "secondary"} onClick={() => setDays(d)}>{d} jours</Button>)}
        <span className="mx-1 h-6 w-px bg-border" />
        {["all", "web", "qr_code", "borne"].map((c) => <Button key={c} size="sm" variant={channel === c ? "default" : "secondary"} onClick={() => setChannel(c)}>{c === "all" ? "Tous les canaux" : CHANNEL[c]}</Button>)}
      </div>

      {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.error ? <p className="text-destructive">Impossible de charger les statistiques.</p> : (
        <>
          <Card>
            <CardHeader><CardTitle>Tunnel de conversion</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {s.n === 0 && <p className="text-sm text-muted-foreground">Aucune visite enregistrée sur cette période. Les données apparaissent dès les premières visites de la carte.</p>}
              {s.funnel.map(([label, v], i) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{label}</span><span>{v} · {pct(v, s.n)}{i > 0 && <span className="ml-2 text-muted-foreground">({pct(v, s.funnel[i - 1]![1])} de l’étape précédente)</span>}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: s.n ? `${(v / s.n) * 100}%` : 0 }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Paniers abandonnés</p><p className="text-3xl font-semibold">{s.abandoned.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Montant non encaissé</p><p className="text-3xl font-semibold">{euro(s.lost)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Taux d’abandon de panier</p><p className="text-3xl font-semibold">{pct(s.abandoned.length, cartsWithItems)}</p></CardContent></Card>
          </div>
          <p className="text-xs text-muted-foreground">Un panier est considéré comme abandonné après {ABANDON_MIN} minutes d’inactivité sans commande validée. Le suivi est anonyme : aucune donnée personnelle n’est enregistrée.</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Où les clients décrochent</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!s.byStep.length && <p className="text-muted-foreground">Aucun abandon.</p>}
                {s.byStep.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span>{STEP_LABEL[k] ?? k}</span><span className="font-semibold">{v} · {pct(v, s.abandoned.length)}</span></div>)}
                {s.byPage.length > 0 && <p className="pt-3 text-xs font-semibold uppercase text-muted-foreground">Dernier écran vu</p>}
                {s.byPage.map(([k, v]) => <div key={k} className="flex justify-between gap-2 text-muted-foreground"><span>{k}</span><span>{v}</span></div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Provenance des visiteurs</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {s.sources.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span>{k}</span><span>{v.visits} visites · {v.orders} commandes ({pct(v.orders, v.visits)})</span></div>)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Articles les plus abandonnés</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {!s.items.length ? <p className="text-sm text-muted-foreground">Aucun article abandonné.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-2">Article</th><th>Paniers</th><th>Quantité</th><th className="text-right">Montant</th></tr></thead>
                  <tbody>{s.items.map((it) => <tr key={it.name} className="border-t border-border"><td className="py-2">{it.name}</td><td>{it.carts}</td><td>{it.qty}</td><td className="text-right">{euro(it.amount)}</td></tr>)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Derniers paniers abandonnés</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {!s.abandoned.length ? <p className="text-sm text-muted-foreground">Aucun panier abandonné.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-2">Date</th>{names && <th>Restaurant</th>}<th>Canal</th><th>Étape</th><th>Articles</th><th className="text-right">Total</th></tr></thead>
                  <tbody>{s.abandoned.slice(0, 50).map((r) => (
                    <tr key={r.session_id} className="border-t border-border align-top">
                      <td className="py-2 whitespace-nowrap">{new Date(r.last_active_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      {names && <td>{names[r.restaurant_id] ?? "—"}</td>}
                      <td>{CHANNEL[r.channel] ?? r.channel}</td>
                      <td>{r.exit_page || STEP_LABEL[r.current_step]}</td>
                      <td>{((r.cart_items as Item[]) ?? []).map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                      <td className="text-right">{euro(Number(r.cart_total))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
