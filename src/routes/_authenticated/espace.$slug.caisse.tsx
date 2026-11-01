import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Banknote, CreditCard, Minus, Plus, Ticket, Trash2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { RestaurantGuard } from "@/components/RestaurantGuard";
import { Crumbs } from "@/components/Crumbs";
import { ItemConfigurator } from "@/components/ItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { getPosState, openPosSession, closePosSession, createPosOrder } from "@/lib/pos-register.functions";
import { posEnabled, changeDue, POS_TENDER_LABELS, type PosTenderMethod, type ZReport } from "@/lib/pos-register";
import { getCatalog } from "@/lib/catalogs";
import { withOptions, loadOptionData, EMPTY_OPTIONS } from "@/lib/menu-options";
import { euro, unitPrice, type Selections } from "@/lib/menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/espace/$slug/caisse")({
  head: () => ({
    meta: [
      { title: "Caisse comptoir — LC Digitale" },
      { name: "description", content: "Encaissement au comptoir : saisie rapide, espèces, carte et titres restaurant." },
      { property: "og:title", content: "Caisse comptoir" },
      { property: "og:description", content: "Écran de caisse tactile du restaurant." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RestaurantGuard level="manager"><Page /></RestaurantGuard>,
});

type Line = { key: string; itemId: string; sel: Selections; qty: number };

function Page() {
  const { slug } = Route.useParams();
  const load = useServerFn(loadRestaurantAdmin);
  const { data: r } = useQuery({ queryKey: ["pos-restaurant", slug], queryFn: () => load({ data: { slug } }) });
  if (!r) return <p className="p-6 text-muted-foreground">Chargement…</p>;
  if (!posEnabled(r)) return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Caisse comptoir</h1>
      <p className="text-muted-foreground">Le mode Caisse comptoir n'est pas activé pour ce restaurant. La caisse actuelle reste utilisée.</p>
      <Button asChild variant="secondary"><Link to="/espace/$slug" params={{ slug }}>Retour</Link></Button>
    </main>
  );
  return <Register restaurantId={r.id} name={r.name} slug={slug} restaurant={r} />;
}

function Register({ restaurantId, name, slug, restaurant }: { restaurantId: string; name: string; slug: string; restaurant: Parameters<typeof getCatalog>[0] }) {
  const qc = useQueryClient();
  const state = useServerFn(getPosState);
  const open = useServerFn(openPosSession);
  const close = useServerFn(closePosSession);
  const sell = useServerFn(createPosOrder);
  const { data: st } = useQuery({ queryKey: ["pos-state", restaurantId], queryFn: () => state({ data: { restaurantId } }) });
  const { data: options } = useQuery({ queryKey: ["pos-options", restaurantId], queryFn: () => loadOptionData(supabase, restaurantId) });
  const catalog = useMemo(() => withOptions(getCatalog(restaurant), options ?? EMPTY_OPTIONS), [restaurant, options]);
  const [cat, setCat] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [item, setItem] = useState<string | null>(null);
  const [mode, setMode] = useState<"pickup" | "dine_in">("dine_in");
  const [pay, setPay] = useState(false);
  const [method, setMethod] = useState<PosTenderMethod>("cash");
  const [given, setGiven] = useState("");
  const [busy, setBusy] = useState(false);
  const [float, setFloat] = useState("0");
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState("");
  const [z, setZ] = useState<{ z_number: number; report: ZReport } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["pos-state", restaurantId] });

  const activeCat = catalog.categories.find((c) => c.id === cat) ?? catalog.categories[0];
  const priced = lines.map((l) => { const it = catalog.itemsById[l.itemId]; return { ...l, it, total: it ? unitPrice(it, l.sel) * l.qty : 0 }; });
  const total = Math.round(priced.reduce((a, l) => a + l.total, 0) * 100) / 100;
  const givenN = Number(given.replace(",", "."));
  const change = method === "cash" ? changeDue(total, given ? givenN : total) : 0;

  const addLine = (itemId: string, sel: Selections, qty: number) => {
    const key = itemId + JSON.stringify(sel);
    setLines((p) => p.some((l) => l.key === key) ? p.map((l) => l.key === key ? { ...l, qty: l.qty + qty } : l) : [...p, { key, itemId, sel, qty }]);
  };
  const tap = (id: string) => { const it = catalog.itemsById[id]; if (!it) return; if ((it.options?.length ?? 0) > 0 || it.builder) setItem(id); else addLine(id, {}, 1); };

  const checkout = async () => {
    setBusy(true);
    try {
      const res = await sell({ data: { restaurantId, mode, lines: lines.map(({ itemId, sel, qty }) => ({ itemId, sel, qty })), tender: { method, ...(method === "cash" && given ? { given: givenN } : {}) } } });
      toast.success(`Vente n°${res.order_number} encaissée${res.tender.change ? ` — rendu ${euro(res.tender.change)}` : ""}`);
      setLines([]); setPay(false); setGiven(""); setMethod("cash"); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (!st) return <p className="p-6 text-muted-foreground">Chargement…</p>;

  if (!st.session) return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <Crumbs slug={slug} page="Caisse" />
      <h1 className="text-2xl font-semibold">Ouvrir la caisse</h1>
      <div className="space-y-2"><Label htmlFor="float">Fond de caisse (€)</Label><Input id="float" inputMode="decimal" className="h-14 text-lg" value={float} onChange={(e) => setFloat(e.target.value)} /></div>
      <Button className="min-h-14 w-full text-lg" onClick={async () => { try { await open({ data: { restaurantId, openingFloat: Number(float.replace(",", ".")) || 0 } }); refresh(); } catch (e) { toast.error((e as Error).message); } }}><Unlock />Ouvrir la caisse</Button>
      {z && <ZView z={z} />}
      {st.history.length > 0 && (
        <section className="space-y-2"><h2 className="font-semibold">Dernières clôtures</h2>
          {st.history.map((h) => { const rep = h.z_report as unknown as ZReport | null; return <div key={h.id} className="flex justify-between rounded-lg border border-border p-3 text-sm"><span>Z n°{h.z_number} — {new Date(h.closed_at!).toLocaleString("fr-FR")}</span><span className="font-semibold">{euro(rep?.total ?? 0)}</span></div>; })}
        </section>
      )}
    </main>
  );

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div><p className="font-semibold">{name} — Caisse</p><p className="text-xs text-muted-foreground">Ouverte le {new Date(st.session.opened_at).toLocaleString("fr-FR")} · {st.live?.orders ?? 0} ventes · {euro(st.live?.total ?? 0)}</p></div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/espace/$slug" params={{ slug }}>Retour</Link></Button>
          <Button variant="secondary" className="min-h-12" onClick={() => setClosing(true)}><Lock />Clôturer</Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_360px]">
        <section className="flex min-h-0 flex-col">
          <div className="flex gap-2 overflow-x-auto border-b border-border p-2">
            {catalog.categories.map((c) => <Button key={c.id} variant={activeCat?.id === c.id ? "default" : "secondary"} className="min-h-12 shrink-0" onClick={() => setCat(c.id)}>{c.label}</Button>)}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3 lg:grid-cols-4">
            {activeCat?.items.map((it) => (
              <button key={it.id} onClick={() => tap(it.id)} className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-card p-3 text-left active:scale-[.98]">
                <span className="font-medium leading-tight">{it.name}</span><span className="text-sm text-muted-foreground">{euro(it.price)}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="flex min-h-0 flex-col border-t border-border md:border-l md:border-t-0">
          <div className="flex gap-2 p-2">
            {(["dine_in", "pickup"] as const).map((m) => <Button key={m} variant={mode === m ? "default" : "secondary"} className="min-h-12 flex-1" onClick={() => setMode(m)}>{m === "dine_in" ? "Sur place" : "À emporter"}</Button>)}
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto p-2">
            {priced.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Touchez un article pour l'ajouter.</li>}
            {priced.map((l) => (
              <li key={l.key} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <span className="flex-1 text-sm">{l.it?.name}</span>
                <Button size="icon" variant="secondary" aria-label="Moins" onClick={() => setLines((p) => p.flatMap((x) => x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []))}><Minus /></Button>
                <span className="w-6 text-center">{l.qty}</span>
                <Button size="icon" variant="secondary" aria-label="Plus" onClick={() => setLines((p) => p.map((x) => x.key === l.key ? { ...x, qty: x.qty + 1 } : x))}><Plus /></Button>
                <span className="w-16 text-right text-sm font-semibold">{euro(l.total)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border p-3">
            <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{euro(total)}</span></div>
            <div className="flex gap-2">
              <Button variant="ghost" className="min-h-14" disabled={!lines.length} onClick={() => setLines([])} aria-label="Vider"><Trash2 /></Button>
              <Button className="min-h-14 flex-1 text-lg" disabled={!lines.length} onClick={() => setPay(true)}>Encaisser</Button>
            </div>
          </div>
        </aside>
      </div>

      <ItemConfigurator item={item ? catalog.itemsById[item] ?? null : null} catalog={catalog} onClose={() => setItem(null)} onAdd={(id, sel, q) => { addLine(id, sel, q); setItem(null); }} />

      <Dialog open={pay} onOpenChange={setPay}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encaisser {euro(total)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {([["cash", Banknote], ["card", CreditCard], ["meal_voucher", Ticket]] as const).map(([m, Icon]) => (
              <Button key={m} variant={method === m ? "default" : "secondary"} className="h-20 flex-col" onClick={() => setMethod(m)}><Icon />{POS_TENDER_LABELS[m]}</Button>
            ))}
          </div>
          {method === "cash" && (
            <div className="space-y-2">
              <Label htmlFor="given">Montant remis (€)</Label>
              <Input id="given" inputMode="decimal" className="h-14 text-lg" placeholder={total.toFixed(2)} value={given} onChange={(e) => setGiven(e.target.value)} />
              <div className="flex flex-wrap gap-2">{[5, 10, 20, 50].filter((b) => b >= total).slice(0, 4).map((b) => <Button key={b} variant="secondary" onClick={() => setGiven(String(b))}>{b} €</Button>)}</div>
              <p className={cn("text-lg font-semibold", change == null && "text-destructive")}>{change == null ? "Montant insuffisant" : `Rendu : ${euro(change)}`}</p>
            </div>
          )}
          {method === "card" && <p className="text-sm text-muted-foreground">Encaissez sur le terminal bancaire puis validez.</p>}
          <Button className="min-h-14 text-lg" disabled={busy || change == null} onClick={checkout}>Valider l'encaissement</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clôturer la caisse (ticket Z)</DialogTitle></DialogHeader>
          {st.live && <p className="text-sm">Espèces attendues : <b>{euro(st.live.expectedCash)}</b> (fond {euro(st.live.openingFloat)} + ventes espèces)</p>}
          <Label htmlFor="counted">Espèces comptées (€)</Label>
          <Input id="counted" inputMode="decimal" className="h-14 text-lg" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <Button className="min-h-14" disabled={busy || counted === ""} onClick={async () => { setBusy(true); try { const res = await close({ data: { restaurantId, countedCash: Number(counted.replace(",", ".")) || 0 } }); setZ(res); setClosing(false); setCounted(""); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Clôturer et éditer le Z</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ZView({ z }: { z: { z_number: number; report: ZReport } }) {
  const r = z.report;
  return (
    <section className="space-y-1 rounded-lg border border-border p-4 text-sm">
      <h2 className="text-lg font-semibold">Ticket Z n°{z.z_number}</h2>
      <p>Ventes : {r.orders} · Total {euro(r.total)}</p>
      {(Object.keys(r.byMethod) as PosTenderMethod[]).map((m) => <p key={m}>{POS_TENDER_LABELS[m]} : {r.byMethod[m].count} · {euro(r.byMethod[m].amount)}</p>)}
      <p>Fond de caisse : {euro(r.openingFloat)} · Espèces attendues : {euro(r.expectedCash)}</p>
      <p>Espèces comptées : {euro(r.countedCash ?? 0)} · Écart : <b>{euro(r.cashDifference ?? 0)}</b></p>
      <Button variant="secondary" className="mt-2" onClick={() => window.print()}>Imprimer</Button>
    </section>
  );
}
