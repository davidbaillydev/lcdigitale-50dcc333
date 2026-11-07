import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import { Banknote, CreditCard, Minus, Plus, Ticket, Trash2, Lock, Unlock, Printer, History, Download } from "lucide-react";
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
import { getPosState, openPosSession, closePosSession, createPosOrder, getPosReceipts, getPosClosures, type PosReceipt } from "@/lib/pos-register.functions";
import { posEnabled, changeDue, CASH_QUICK_AMOUNTS, posClosuresCsv, POS_TENDER_LABELS, type PosTenderMethod, type ZReport } from "@/lib/pos-register";
import type { Restaurant } from "@/lib/shop";
import { printPosReceipt, printPosReport, type PosReportTicket } from "@/lib/pos-print";
import type { TicketShop } from "@/lib/ticket";
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

function Register({ restaurantId, name, slug, restaurant }: { restaurantId: string; name: string; slug: string; restaurant: Restaurant }) {
  const qc = useQueryClient();
  const state = useServerFn(getPosState);
  const open = useServerFn(openPosSession);
  const close = useServerFn(closePosSession);
  const sell = useServerFn(createPosOrder);
  const loadReceipts = useServerFn(getPosReceipts);
  const loadClosures = useServerFn(getPosClosures);
  const { data: st } = useQuery({ queryKey: ["pos-state", restaurantId], queryFn: () => state({ data: { restaurantId } }), refetchInterval: 15000 });
  const { data: options } = useQuery({ queryKey: ["pos-options", restaurantId], queryFn: () => loadOptionData(supabase, restaurantId) });
  const catalog = useMemo(() => withOptions(getCatalog(restaurant), options ?? EMPTY_OPTIONS), [restaurant, options]);
  const shop: TicketShop = { name, address: restaurant.address, phone: restaurant.phone, slug, customDomains: restaurant.config.customDomains, catalog, optionData: options, legal: restaurant.legal };
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
  const [tickets, setTickets] = useState(false);
  const [journal, setJournal] = useState(false);
  const [page, setPage] = useState(0);
  const [reportTicket, setReportTicket] = useState<PosReportTicket | null>(null);
  const [failedReceipt, setFailedReceipt] = useState<PosReceipt | null>(null);
  const saleLock = useRef(false);
  const requestId = useRef<string | null>(null);
  const { data: receipts } = useQuery({ queryKey: ["pos-receipts", restaurantId, st?.session?.id, page], enabled: tickets && !!st?.session, queryFn: () => loadReceipts({ data: { restaurantId, sessionId: st?.session?.id ?? "", page } }), refetchInterval: tickets ? 15000 : false });
  const { data: closures } = useQuery({ queryKey: ["pos-closures", restaurantId], enabled: journal, queryFn: () => loadClosures({ data: { restaurantId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["pos-state", restaurantId] });
  const printReport = async (t: PosReportTicket) => { if (!await printPosReport(shop, t)) toast.error("Impression impossible. Vous pouvez réimprimer le rapport."); };
  const reprint = async (o: PosReceipt) => { if (!await printPosReceipt(o, shop, true)) toast.error("Ticket enregistré, imprimante indisponible."); else if (failedReceipt?.id === o.id) setFailedReceipt(null); };
  const exportJournal = async () => {
    try {
      const rows = await loadClosures({ data: { restaurantId } });
      const url = URL.createObjectURL(new Blob([posClosuresCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `journal-Z-${slug}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error((e as Error).message); }
  };
  const journalControls = <Button variant="secondary" className="min-h-12" onClick={() => setJournal(true)}><History />Journal Z</Button>;
  const reports = <>
    <Dialog open={journal} onOpenChange={setJournal}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Journal des clôtures Z</DialogTitle></DialogHeader>
      <Button variant="secondary" className="min-h-12" onClick={exportJournal}><Download />Exporter CSV</Button>
      {!closures ? <p>Chargement…</p> : closures.length === 0 ? <p className="text-muted-foreground">Aucune clôture.</p> : closures.map((h) => <div key={h.id} className="flex items-center justify-between gap-3 border-b border-border py-3"><div><p className="font-semibold">Z n°{h.z_number} · {euro((h.z_report as unknown as ZReport).total)}</p><p className="text-sm text-muted-foreground">{h.closed_at ? new Date(h.closed_at).toLocaleString("fr-FR") : ""}</p></div><Button variant="secondary" className="min-h-12" aria-label={`Consulter Z ${h.z_number}`} onClick={() => { setJournal(false); setReportTicket({ kind: "Z", number: h.z_number ?? undefined, report: h.z_report as unknown as ZReport, openedAt: h.opened_at, at: h.closed_at ?? h.opened_at }); }}><Ticket /></Button></div>)}
    </DialogContent></Dialog>
    <Dialog open={!!reportTicket} onOpenChange={(v) => { if (!v) setReportTicket(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Ticket {reportTicket?.kind}{reportTicket?.number != null ? ` n°${reportTicket.number}` : " — en cours"}</DialogTitle></DialogHeader>
      {reportTicket && <><ReportView report={reportTicket.report} /><Button className="min-h-12" onClick={() => printReport(reportTicket)}><Printer />Imprimer le ticket {reportTicket.kind}</Button></>}
    </DialogContent></Dialog>
  </>;

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
    if (saleLock.current) return;
    saleLock.current = true;
    setBusy(true);
    try {
      requestId.current ??= crypto.randomUUID();
      const res = await sell({ data: { restaurantId, requestId: requestId.current, mode, lines: lines.map(({ itemId, sel, qty }) => ({ itemId, sel, qty })), tender: { method, ...(method === "cash" && given ? { given: givenN } : {}) } } });
      requestId.current = null;
      toast.success(`Ticket n°${res.pos_receipt_number} encaissé${res.pos_tender.change ? ` — rendu ${euro(res.pos_tender.change)}` : ""}`);
      setLines([]); setPay(false); setGiven(""); setMethod("cash"); refresh();
      qc.invalidateQueries({ queryKey: ["pos-receipts", restaurantId] });
      if (!await printPosReceipt(res, shop)) { setFailedReceipt(res); toast.error("Vente encaissée, mais impression impossible. Réimprimez le ticket sans encaisser à nouveau."); }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); saleLock.current = false; }
  };

  if (!st) return <p className="p-6 text-muted-foreground">Chargement…</p>;

  if (!st.session) return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <Crumbs slug={slug} page="Caisse" />
      <h1 className="text-2xl font-semibold">Ouvrir la caisse</h1>
      <div className="space-y-2"><Label htmlFor="float">Fond de caisse (€)</Label><Input id="float" inputMode="decimal" className="h-14 text-lg" value={float} onChange={(e) => setFloat(e.target.value)} /></div>
      <Button className="min-h-14 w-full text-lg" onClick={async () => { try { await open({ data: { restaurantId, openingFloat: Number(float.replace(",", ".")) || 0 } }); refresh(); } catch (e) { toast.error((e as Error).message); } }}><Unlock />Ouvrir la caisse</Button>
      {journalControls}
      {reports}
      {z && <ReportView report={z.report} />}
      {st.history.length > 0 && (
        <section className="space-y-2"><h2 className="font-semibold">Dernières clôtures</h2>
          {st.history.map((h) => { const rep = h.z_report as unknown as ZReport | null; return <div key={h.id} className="flex items-center justify-between gap-2 border-b border-border py-3 text-sm"><span>Z n°{h.z_number} — {h.closed_at ? new Date(h.closed_at).toLocaleString("fr-FR") : ""}<br />{euro(rep?.total ?? 0)}</span><Button variant="secondary" className="min-h-12" aria-label={`Imprimer Z ${h.z_number}`} onClick={() => { if (rep && h.closed_at) printReport({ kind: "Z", number: h.z_number ?? undefined, openedAt: h.opened_at, at: h.closed_at, report: rep }); }}><Printer /></Button></div>; })}
        </section>
      )}
    </main>
  );

  return (
    <main className="pos-register flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div><p className="font-semibold">{name} — Caisse</p><p className="text-xs text-muted-foreground">Ouverte le {new Date(st.session.opened_at).toLocaleString("fr-FR")} · {st.live?.orders ?? 0} ventes · {euro(st.live?.total ?? 0)}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => { setPage(0); setTickets(true); }}><History />Tickets</Button>
          <Button variant="secondary" className="min-h-12" onClick={async () => { try { const fresh = await state({ data: { restaurantId } }); if (fresh.session && fresh.live) setReportTicket({ kind: "X", openedAt: fresh.session.opened_at, at: new Date().toISOString(), report: fresh.live }); else { refresh(); toast.error("La caisse est fermée."); } } catch (e) { toast.error((e as Error).message); } }}><Ticket />Ticket X</Button>
          {journalControls}
          <Button asChild variant="ghost"><Link to="/espace/$slug" params={{ slug }}>Retour</Link></Button>
          <Button variant="secondary" className="min-h-12" onClick={() => setClosing(true)}><Lock />Clôturer</Button>
        </div>
      </header>
      {failedReceipt && <div className="flex items-center justify-between gap-2 border-b border-border p-2 text-sm text-destructive"><span>Ticket n°{failedReceipt.pos_receipt_number} : impression à relancer</span><Button variant="secondary" onClick={() => reprint(failedReceipt)}><Printer />Réimprimer</Button></div>}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_360px]">
        <section className="flex min-h-0 flex-col">
          <div className="flex gap-2 overflow-x-auto border-b border-border p-2">
            {catalog.categories.map((c) => <Button key={c.id} variant={activeCat?.id === c.id ? "default" : "secondary"} className="min-h-12 shrink-0" onClick={() => setCat(c.id)}>{c.label}</Button>)}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3 lg:grid-cols-4">
            {activeCat?.items.map((it) => (
              <Button variant="outline" key={it.id} onClick={() => tap(it.id)} className="flex h-auto min-h-24 flex-col items-start justify-between whitespace-normal rounded-lg p-3 text-left active:scale-[.98]">
                <span className="font-medium leading-tight">{it.name}</span><span className="text-sm text-muted-foreground">{euro(it.price)}</span>
              </Button>
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

      {reports}
      <Dialog open={tickets} onOpenChange={setTickets}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Tickets de la session · {receipts?.count ?? 0}</DialogTitle></DialogHeader>
        {!receipts ? <p>Chargement…</p> : receipts.receipts.length === 0 ? <p className="text-muted-foreground">Aucun ticket.</p> : receipts.receipts.map((o) => <div key={o.id} className="flex items-center justify-between gap-3 border-b border-border py-3"><div><p className="font-semibold">Ticket n°{o.pos_receipt_number} · {euro(Number(o.total))}</p><p className="text-sm text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleTimeString("fr-FR") : ""} · {POS_TENDER_LABELS[o.pos_tender.method]}{o.status === "cancelled" ? " · Annulé" : ""}</p></div><Button variant="secondary" className="min-h-12" aria-label={`Réimprimer ticket ${o.pos_receipt_number}`} onClick={() => reprint(o)}><Printer /></Button></div>)}
        <div className="flex justify-between gap-2"><Button variant="secondary" className="min-h-12" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédents</Button><Button variant="secondary" className="min-h-12" disabled={(page + 1) * 30 >= (receipts?.count ?? 0)} onClick={() => setPage((p) => p + 1)}>Suivants</Button></div>
      </DialogContent></Dialog>
      <Dialog open={pay} onOpenChange={(v) => { if (!busy) setPay(v); }}>
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
              <div className="grid grid-cols-3 gap-2"><Button variant="secondary" className="min-h-12" onClick={() => setGiven(total.toFixed(2))}>Compte juste</Button>{CASH_QUICK_AMOUNTS.map((b) => <Button key={b} variant="secondary" className="min-h-12" onClick={() => setGiven(String(b))}>{b} €</Button>)}</div>
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
          {counted !== "" && st.live && <p>Écart : <b>{euro(Number(counted.replace(",", ".")) - st.live.expectedCash)}</b></p>}
          <Button className="min-h-14" disabled={busy || counted === "" || !Number.isFinite(Number(counted.replace(",", ".")))} onClick={async () => { setBusy(true); try { const res = await close({ data: { restaurantId, countedCash: Number(counted.replace(",", ".")) } }); setZ(res); setClosing(false); setCounted(""); const t: PosReportTicket = { kind: "Z", number: res.z_number, openedAt: res.opened_at, at: res.closed_at, report: res.report }; setReportTicket(t); refresh(); qc.invalidateQueries({ queryKey: ["pos-closures", restaurantId] }); await printReport(t); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Clôturer et imprimer le Z</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ReportView({ report: r }: { report: ZReport }) {
  return (
    <section className="space-y-2 py-3 text-sm">
      <p>Ventes : {r.orders} · Total {euro(r.total)}</p>
      {(Object.keys(r.byMethod) as PosTenderMethod[]).map((m) => <p key={m}>{POS_TENDER_LABELS[m]} : {r.byMethod[m].count} · {euro(r.byMethod[m].amount)}</p>)}
      <p>Fond de caisse : {euro(r.openingFloat)} · Espèces attendues : {euro(r.expectedCash)}</p>
      {r.countedCash != null ? <p>Espèces comptées : {euro(r.countedCash)} · Écart : <b>{euro(r.cashDifference ?? 0)}</b></p> : <p className="text-muted-foreground">Caisse toujours ouverte</p>}
    </section>
  );
}
