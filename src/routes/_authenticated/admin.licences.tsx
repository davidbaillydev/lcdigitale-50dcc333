import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";
import { KioskLicenseDashboard } from "@/components/KioskLicenseDashboard";
import { KioskAuditJournal } from "@/components/KioskAuditJournal";
import { demoKioskActive, kioskDemoData, kioskRestaurantRows } from "@/lib/kiosk-dashboard";
import { annualEnd } from "@/lib/kiosk-licenses";
import { kioskReadersOf } from "@/lib/kiosk-readers";
import { getKioskAudit, getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense, registerLicensedKiosk, setLicensedKioskActive } from "@/lib/kiosk-licenses.functions";

type SearchState = { q?: string; unpaid?: boolean; restaurant?: string; demo?: boolean; auditPage?: number };
const options = queryOptions({ queryKey: ["agency-kiosk-licenses"], queryFn: () => getKioskLicenses() });
const auditOptions = (restaurant: string, page: number) => queryOptions({ queryKey: ["agency-kiosk-audit", restaurant, page], queryFn: () => getKioskAudit({ data: { restaurantId: restaurant === "all" || restaurant.startsWith("demo-") ? null : restaurant, page } }) });
export const Route = createFileRoute("/_authenticated/admin/licences")({
  validateSearch: (s: Record<string, unknown>): SearchState => ({ q: typeof s["q"] === "string" ? s["q"] : "", unpaid: s["unpaid"] === true || s["unpaid"] === "true", restaurant: typeof s["restaurant"] === "string" ? s["restaurant"] : "all", demo: s["demo"] === true || s["demo"] === "true", auditPage: Math.max(0, Math.min(100000, Math.floor(Number(s["auditPage"]) || 0))) }),
  loaderDeps: ({ search }) => ({ restaurant: search.restaurant ?? "all", page: search.auditPage ?? 0 }),
  errorComponent: ({ error }) => <main className="p-6" role="alert">Impossible de charger les licences : {error instanceof Error ? error.message : "Réessayez ultérieurement."}</main>,
  notFoundComponent: () => <main className="p-6">Page de licences introuvable.</main>,
  head: () => ({ meta: [
    { title: "Licences bornes & facturation — LC Digitale" },
    { name: "description", content: "Suivi agence des licences logiciel borne à 400 € HT par an et de leur facturation." },
    { property: "og:title", content: "Licences bornes — LC Digitale" },
    { property: "og:description", content: "Licences annuelles et suivi des factures par restaurant et par borne." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context, deps }) => Promise.all([context.queryClient.ensureQueryData(options), context.queryClient.ensureQueryData(auditOptions(deps.restaurant, deps.page))]), component: Page,
});
type Data = Awaited<ReturnType<typeof getKioskLicenses>>;
type License = Data["licenses"][number];
type Billing = Data["billing"][number];
type Draft = { restaurantId: string; kioskId: string; label: string; status: "active" | "suspended" | "ended"; startsOn: string; notes: string };
const money = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const date = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("fr-FR");
const billingLabels: Record<string, string> = { to_invoice: "À facturer", invoiced: "Facturée", paid: "Réglée (déclaré)", cancelled: "Annulée" };
const selectClass = "h-12 w-full rounded-md border border-input bg-background px-3 text-foreground";

function Page() {
  const { data, refetch, isFetching } = useSuspenseQuery(options);
  const search = Route.useSearch(), navigate = useNavigate({ from: Route.fullPath });
  const restaurant = search.restaurant ?? "all";
  const setRestaurant = (value: string) => void navigate({ search: (prev) => ({ ...prev, restaurant: value, auditPage: 0 }) });
  const { data: audit, refetch: refetchAudit } = useSuspenseQuery(auditOptions(restaurant, search.auditPage ?? 0));
  const [demoData, setDemoData] = useState(() => kioskDemoData(data.today));
  const source = search.demo ? demoData : data;
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const toggle = useServerFn(setLicensedKioskActive), register = useServerFn(registerLicensedKiosk);
  const changeKiosk = async (restaurantId: string, kioskId: string, active: boolean) => {
    if (search.demo) { setDemoData((prev) => demoKioskActive(prev, restaurantId, kioskId, active)); return; }
    const key = `${restaurantId}:${kioskId}`;
    setToggleBusy(key); setOverrides({ [key]: active });
    try { await toggle({ data: { restaurantId, kioskId, active } }); await Promise.all([refetch(), refetchAudit()]); toast.success(active ? "Borne réactivée" : "Borne suspendue"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Modification impossible"); }
    finally { setOverrides({}); setToggleBusy(null); }
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bill, setBill] = useState<Billing | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveKioskLicense), prepare = useServerFn(prepareKioskBilling), saveBill = useServerFn(saveKioskBilling);
  const licenses = data.licenses.filter((l) => restaurant === "all" || l.restaurant_id === restaurant);
  const bills = data.billing.filter((b) => licenses.some((l) => l.id === b.license_id));
  const rs = (id: string) => data.restaurants.find((r) => r.id === id);
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await fn(); await Promise.all([refetch(), refetchAudit()]); toast.success(success); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); return false; }
    finally { setBusy(false); }
  };
  const newLicense = (restaurantId = restaurant !== "all" ? restaurant : source.restaurants[0]?.id ?? "", kioskId = "", label = "") => {
    setEditing(false); setDraft({ restaurantId, kioskId, label, status: "active", startsOn: data.today, notes: "" });
  };
  const edit = (l: License, renew = false) => {
    setEditing(true); setDraft({ restaurantId: l.restaurant_id, kioskId: l.kiosk_id, label: l.label, status: renew ? "active" : l.status as Draft["status"], startsOn: renew ? l.ends_on : l.starts_on, notes: l.notes });
  };
  const exportCsv = () => {
    const rows = [["Restaurant", "Borne", "Libellé", "Début", "Fin", "Montant HT EUR", "État", "Référence facture", "Échéance", "Règlement déclaré"]];
    for (const b of bills) {
      const l = licenses.find((x) => x.id === b.license_id);
      rows.push([rs(l?.restaurant_id ?? "")?.name ?? "", l?.kiosk_id ?? "", l?.label ?? "", b.starts_on, b.ends_on, String(b.amount_ht_cents / 100), billingLabels[b.status] ?? b.status, b.invoice_reference, b.due_on ?? "", b.paid_on ?? ""]);
    }
    const cell = (s: string) => `"${(/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "facturation-licences-bornes.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const rowCount = kioskRestaurantRows(source);
  const openEdit = (id: string) => {
    const l = source.licenses.find((x) => x.id === id);
    if (!l) return;
    if (!search.demo) { const live = data.licenses.find((x) => x.id === id); if (live) edit(live); }
    else { setEditing(true); setDraft({ restaurantId: l.restaurant_id, kioskId: l.kiosk_id, label: l.label, status: l.status as Draft["status"], startsOn: l.starts_on, notes: "" }); }
  };
  const openBilling = (id: string) => {
    if (!search.demo) { const b = data.billing.find((x) => x.license_id === id && source.licenses.some((l) => l.id === id && l.starts_on === x.starts_on && l.ends_on === x.ends_on)); if (b) setBill({ ...b }); else void action(() => prepare({ data: { licenseId: id } }), "Période de facturation préparée"); return; }
    const b = demoData.billing.find((x) => x.license_id === id);
    if (b) setBill({ ...b, id, amount_ht_cents: 40000, invoice_reference: `FACT-${id}`, paid_on: b.status === "paid" ? data.today : null, notes: "", created_at: "", updated_at: "", updated_by: "demo" });
  };
  const submitDraft = async () => {
    if (!draft) return false;
    if (search.demo) {
      const duplicate = demoData.licenses.some((l) => l.restaurant_id === draft.restaurantId && l.kiosk_id === draft.kioskId);
      if (!editing && duplicate) { toast.error("Identifiant de borne déjà utilisé"); return false; }
      if (editing) setDemoData((prev) => ({ ...prev, licenses: prev.licenses.map((l) => l.restaurant_id === draft.restaurantId && l.kiosk_id === draft.kioskId ? { ...l, label: draft.label, status: draft.status, starts_on: draft.startsOn, ends_on: annualEnd(draft.startsOn) } : l) }));
      else {
        const id = `DEMO-${draft.restaurantId}-${draft.kioskId}`;
        setDemoData((prev) => ({ restaurants: prev.restaurants.map((r) => r.id === draft.restaurantId ? { ...r, config: { kioskReaders: [...kioskReadersOf(r.config), { id: draft.kioskId, label: draft.label || `Borne ${draft.kioskId}`, reader: "", active: true }] } } : r), licenses: [...prev.licenses, { id, restaurant_id: draft.restaurantId, kiosk_id: draft.kioskId, label: draft.label, status: "active", starts_on: draft.startsOn, ends_on: annualEnd(draft.startsOn) }], billing: [...prev.billing, { license_id: id, starts_on: draft.startsOn, ends_on: annualEnd(draft.startsOn), status: "to_invoice", due_on: null }] }));
      }
      return true;
    }
    return action(async () => {
      if (editing) return save({ data: draft });
      if (data.licenses.some((l) => l.restaurant_id === draft.restaurantId && l.kiosk_id === draft.kioskId)) throw new Error("Cet identifiant possède déjà une licence. Modifiez la licence existante.");
      const declared = kioskReadersOf(data.restaurants.find((r) => r.id === draft.restaurantId)?.config).some((k) => k.id === draft.kioskId);
      if (!declared) return register({ data: draft });
      const row = await save({ data: draft });
      return prepare({ data: { licenseId: row.id } });
    }, "Borne et licence enregistrées");
  };
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <div className="flex items-center gap-3"><Crumbs page="Bornes & licences" /><span className="mr-auto" /><ThemeToggle /></div>
    <header className="flex flex-wrap items-end gap-4"><div className="mr-auto min-w-0"><p className="text-sm font-semibold text-primary">Console agence / Parc de bornes</p><h1 className="mt-2 text-4xl sm:text-5xl">Bornes & licences</h1><p className="mt-3 text-muted-foreground">400 € HT / an / borne active</p></div><Button variant="outline" className="h-12" onClick={() => void Promise.all([refetch(), refetchAudit()])} disabled={isFetching || !!search.demo}><RefreshCw />Actualiser</Button><Button className="h-12" onClick={() => newLicense()} disabled={!source.restaurants.length}><Plus />Ajouter une borne</Button></header>
    <div className="flex flex-wrap items-center gap-2 border-b pb-4"><Button variant={!search.demo ? "default" : "ghost"} className="h-12" onClick={() => void navigate({ search: (prev) => ({ ...prev, demo: false, restaurant: "all" }) })}>Parc réel</Button><Button variant={search.demo ? "default" : "ghost"} className="h-12" onClick={() => void navigate({ search: (prev) => ({ ...prev, demo: true, restaurant: "all" }) })}>Démonstration · 3 restaurants</Button><p className="ml-auto text-xs text-muted-foreground">{search.demo ? "Données fictives · aucune borne réelle modifiée" : "Règlements déclarés · aucun blocage automatique"}</p></div>
    <div className="flex flex-wrap gap-4"><div className="relative min-w-0 flex-1 basis-64"><Search className="absolute left-3 top-4 size-4 text-muted-foreground" /><Input aria-label="Rechercher un restaurant ou une ville" className="h-12 pl-10" placeholder="Rechercher un restaurant, une ville…" value={search.q ?? ""} onChange={(e) => void navigate({ search: (prev) => ({ ...prev, q: e.target.value }), replace: true })} /></div><select aria-label="Restaurant" className={selectClass + " sm:max-w-60"} value={restaurant} onChange={(e) => setRestaurant(e.target.value)}><option value="all">Tous les restaurants</option>{source.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><Button variant={search.unpaid ? "default" : "outline"} aria-pressed={!!search.unpaid} className="h-12" onClick={() => void navigate({ search: (prev) => ({ ...prev, unpaid: !prev.unpaid }) })}>Licences impayées <span className="tabular-nums">{rowCount.reduce((n, r) => n + r.unpaid, 0)}</span></Button></div>
    <KioskLicenseDashboard data={source} search={search.q ?? ""} unpaidOnly={!!search.unpaid} restaurantId={restaurant} busy={toggleBusy} overrides={overrides} onToggle={(r, k, a) => void changeKiosk(r, k, a)} onAdd={(r) => newLicense(r)} onEdit={openEdit} onBilling={openBilling} />
    {!search.demo && <><p className="border-l-2 border-primary pl-4 text-xs text-muted-foreground">Règlements renseignés par l’agence, sans confirmation bancaire. Une suspension est toujours une action manuelle et concerne uniquement la borne sélectionnée.</p><KioskAuditJournal data={audit} page={search.auditPage ?? 0} onPage={(page) => void navigate({ search: (prev) => ({ ...prev, auditPage: page }) })} /></>}
    {!search.demo && <section><div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto text-2xl">Suivi de facturation</h2><Button variant="outline" className="h-12" onClick={exportCsv} disabled={!bills.length}><Download />Exporter CSV</Button></div><p className="mt-2 text-sm text-muted-foreground">Une ligne par borne et par période annuelle ; références des factures émises hors plateforme.</p><div className="mt-4 divide-y border-y">{bills.map((b) => { const l = licenses.find((x) => x.id === b.license_id); return <article key={b.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{rs(l?.restaurant_id ?? "")?.name} · Borne {l?.kiosk_id}</h3><p className="text-sm text-muted-foreground">{date(b.starts_on)} → {date(b.ends_on)}</p><p className="mt-1 break-words text-sm">{billingLabels[b.status]}{b.invoice_reference && ` · ${b.invoice_reference}`}{b.due_on && ` · échéance ${date(b.due_on)}`}{b.paid_on && ` · règlement ${date(b.paid_on)}`}</p></div><p className="text-xl font-semibold tabular-nums">{money(b.amount_ht_cents)} HT</p><Button variant="outline" className="h-12" onClick={() => setBill({ ...b })}><Pencil />Suivre la facture</Button></article>; })}{!bills.length && <p className="py-8 text-muted-foreground">Aucune période de facturation préparée.</p>}</div></section>}
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Modifier la licence" : "Ajouter une borne sous licence"}</DialogTitle></DialogHeader>{draft && <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await submitDraft()) setDraft(null); }}>
      <div><Label htmlFor="license-restaurant">Restaurant</Label><select id="license-restaurant" className={selectClass + " mt-1"} disabled={editing || busy} value={draft.restaurantId} onChange={(e) => setDraft({ ...draft, restaurantId: e.target.value })}>{source.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="license-kiosk">Numéro de borne</Label><Input id="license-kiosk" className="h-12" required pattern="[a-z0-9-]{1,20}" maxLength={20} disabled={editing || busy} value={draft.kioskId} onChange={(e) => setDraft({ ...draft, kioskId: e.target.value.toLowerCase() })} /></div><div><Label htmlFor="license-label">Libellé</Label><Input id="license-label" className="h-12" maxLength={40} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div></div>
      {editing && <div><Label htmlFor="license-status">État de la licence</Label><select id="license-status" className={selectClass + " mt-1"} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}><option value="active">Active</option><option value="suspended">Suspendue</option><option value="ended">Terminée</option></select></div>}
      <div><Label htmlFor="license-start">Début de la période annuelle</Label><Input id="license-start" className="h-12" type="date" required value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} /><p className="mt-2 text-sm text-muted-foreground">Fin : {draft.startsOn && /^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn) ? date(annualEnd(draft.startsOn)) : "—"} · 400 € HT</p></div>
      {editing && <div><Label htmlFor="license-notes">Notes</Label><Input id="license-notes" className="h-12" maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>}<Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer la licence"}</Button>
    </form>}</DialogContent></Dialog>
    <Dialog open={bill !== null} onOpenChange={(open) => { if (!open && !busy) setBill(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Suivre la facture · 400 € HT</DialogTitle></DialogHeader>{bill && <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (search.demo) { setDemoData((prev) => ({ ...prev, billing: prev.billing.map((b) => b.license_id === bill.license_id ? { ...b, status: bill.status, due_on: bill.due_on } : b) })); setBill(null); return; } if (await action(() => saveBill({ data: { id: bill.id, status: bill.status as "to_invoice" | "invoiced" | "paid" | "cancelled", invoiceReference: bill.invoice_reference, dueOn: bill.due_on, paidOn: bill.paid_on, notes: bill.notes } }), "Suivi de facturation enregistré")) setBill(null); }}>
      <div><Label htmlFor="bill-status">État de facturation</Label><select id="bill-status" className={selectClass + " mt-1"} value={bill.status} onChange={(e) => setBill({ ...bill, status: e.target.value })}>{Object.entries(billingLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><Label htmlFor="bill-ref">Référence de facture</Label><Input id="bill-ref" className="h-12" required={bill.status === "invoiced" || bill.status === "paid"} maxLength={120} value={bill.invoice_reference} onChange={(e) => setBill({ ...bill, invoice_reference: e.target.value })} /></div>
      <div><Label htmlFor="bill-due">Échéance</Label><Input id="bill-due" className="h-12" type="date" value={bill.due_on ?? ""} onChange={(e) => setBill({ ...bill, due_on: e.target.value || null })} /></div>
      {bill.status === "paid" && <div><Label htmlFor="bill-paid">Date de règlement déclaré</Label><Input id="bill-paid" className="h-12" required type="date" value={bill.paid_on ?? ""} onChange={(e) => setBill({ ...bill, paid_on: e.target.value || null })} /></div>}
      <div><Label htmlFor="bill-notes">Notes</Label><Input id="bill-notes" className="h-12" maxLength={2000} value={bill.notes} onChange={(e) => setBill({ ...bill, notes: e.target.value })} /></div><Button className="h-12 w-full" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le suivi"}</Button>
    </form>}</DialogContent></Dialog>
  </main>;
}