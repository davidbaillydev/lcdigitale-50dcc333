import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Pencil, Plus, RefreshCw, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";
import { BrandLogo } from "@/lib/brand";
import { annualEnd, annualTotal, licenseActive } from "@/lib/kiosk-licenses";
import { kioskReadersOf } from "@/lib/kiosk-readers";
import { getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense } from "@/lib/kiosk-licenses.functions";

const options = queryOptions({ queryKey: ["agency-kiosk-licenses"], queryFn: () => getKioskLicenses() });
export const Route = createFileRoute("/_authenticated/admin/licences")({
  head: () => ({ meta: [
    { title: "Licences bornes & facturation — LC Digitale" },
    { name: "description", content: "Suivi agence des licences logiciel borne à 400 € HT par an et de leur facturation." },
    { property: "og:title", content: "Licences bornes — LC Digitale" },
    { property: "og:description", content: "Licences annuelles et suivi des factures par restaurant et par borne." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(options), component: Page,
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
  const [restaurant, setRestaurant] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bill, setBill] = useState<Billing | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveKioskLicense), prepare = useServerFn(prepareKioskBilling), saveBill = useServerFn(saveKioskBilling);
  const licenses = data.licenses.filter((l) => restaurant === "all" || l.restaurant_id === restaurant);
  const bills = data.billing.filter((b) => licenses.some((l) => l.id === b.license_id));
  const total = annualTotal(licenses, data.today);
  const rs = (id: string) => data.restaurants.find((r) => r.id === id);
  const state = (l: License) => l.status === "ended" ? "Terminée" : l.status === "suspended" ? "Suspendue" : l.starts_on > data.today ? "À venir" : l.ends_on <= data.today ? "Expirée" : "Active";
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await fn(); await refetch(); toast.success(success); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); return false; }
    finally { setBusy(false); }
  };
  const newLicense = (restaurantId = restaurant !== "all" ? restaurant : data.restaurants[0]?.id ?? "", kioskId = "", label = "") => {
    setEditing(false); setDraft({ restaurantId, kioskId, label, status: "active", startsOn: data.today, notes: "" });
  };
  const edit = (l: License, renew = false) => {
    setEditing(true); setDraft({ restaurantId: l.restaurant_id, kioskId: l.kiosk_id, label: l.label, status: renew ? "active" : l.status as Draft["status"], startsOn: renew ? l.ends_on : l.starts_on, notes: l.notes });
  };
  const exportCsv = () => {
    const rows = [["Restaurant", "Borne", "Libellé", "Début", "Fin", "Montant HT EUR", "État", "Référence facture", "Échéance", "Règlement déclaré"]];
    for (const b of bills) {
      const l = licenses.find((x) => x.id === b.license_id);
      rows.push([rs(l?.restaurant_id ?? "")?.name ?? "", l?.kiosk_id ?? "", l?.label ?? "", b.starts_on, b.ends_on, String(b.amount_ht_cents / 100), billingLabels[b.status], b.invoice_reference, b.due_on ?? "", b.paid_on ?? ""]);
    }
    const cell = (s: string) => `"${(/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "facturation-licences-bornes.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const declared = data.restaurants.filter((r) => restaurant === "all" || r.id === restaurant).flatMap((r) => kioskReadersOf(r.config).filter((k) => !data.licenses.some((l) => l.restaurant_id === r.id && l.kiosk_id === k.id)).map((k) => ({ ...k, restaurant: r })));
  return <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
    <div className="flex items-center gap-3"><Crumbs page="Licences bornes" /><span className="mr-auto" /><ThemeToggle /></div>
    <header className="flex flex-wrap items-end gap-4"><div className="mr-auto min-w-0"><p className="text-sm font-semibold text-primary">Logiciel · abonnement annuel</p><h1 className="mt-2 text-4xl sm:text-5xl">Licences bornes</h1><p className="mt-3 text-muted-foreground">400 € HT / an / borne active</p></div><Button variant="outline" className="h-12" onClick={() => void refetch()} disabled={isFetching}><RefreshCw />Actualiser</Button><Button className="h-12" onClick={() => newLicense()} disabled={!data.restaurants.length}><Plus />Ajouter une borne</Button></header>
    <div className="flex flex-wrap items-end gap-4 border-y py-4"><label className="w-full text-sm sm:max-w-sm">Restaurant<select aria-label="Restaurant" className={selectClass + " mt-2"} value={restaurant} onChange={(e) => setRestaurant(e.target.value)}><option value="all">Tous les restaurants</option>{data.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
    <section aria-label="Résumé des licences" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[["Bornes sous licence active", String(licenses.filter((l) => licenseActive(l, data.today)).length)], ["Total annuel HT", money(total)], ["À facturer HT", money(bills.filter((b) => b.status === "to_invoice").reduce((s, b) => s + b.amount_ht_cents, 0))], ["Facturé non réglé HT", money(bills.filter((b) => b.status === "invoiced").reduce((s, b) => s + b.amount_ht_cents, 0))]].map(([label, value]) => <div key={label} className="min-w-0 border-b pb-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-3xl font-semibold tabular-nums">{value}</p></div>)}</section>
    <p className="border-l-4 border-primary pl-4 text-sm text-muted-foreground">Suivi agence uniquement : aucun prélèvement, envoi de facture ou blocage automatique de borne. Les règlements sont déclarés manuellement, sans confirmation bancaire. Les montants affichés sont hors taxes.</p>
    {declared.length > 0 && <section className="border-y py-5"><h2 className="text-xl">Bornes configurées sans licence enregistrée</h2><div className="mt-3 flex flex-wrap gap-3">{declared.map((k) => <Button variant="outline" className="h-auto min-h-12 whitespace-normal text-left" key={`${k.restaurant.id}:${k.id}`} onClick={() => newLicense(k.restaurant.id, k.id, k.label)}><Plus />{k.restaurant.name} · {k.label} · {k.id}</Button>)}</div></section>}
    <section><h2 className="text-2xl">Parc sous licence</h2><div className="mt-4 divide-y border-y">{licenses.map((l) => <article key={l.id} className="flex flex-wrap items-center gap-4 py-5"><div className="flex min-w-0 flex-1 items-center gap-3">{rs(l.restaurant_id)?.logo_url ? <BrandLogo src={rs(l.restaurant_id)?.logo_url} name={rs(l.restaurant_id)?.name ?? ""} className="size-12 shrink-0 object-contain" /> : <Tablet className="size-10 shrink-0 text-primary" />}<div className="min-w-0"><h3 className="break-words text-lg font-semibold">{rs(l.restaurant_id)?.name} · Borne {l.kiosk_id}</h3>{l.label && <p className="break-words text-sm text-muted-foreground">{l.label}</p>}<p className="mt-1 text-sm text-muted-foreground">{date(l.starts_on)} → {date(l.ends_on)} · {state(l)} · 400 € HT/an</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="h-12" onClick={() => edit(l)}><Pencil />Modifier</Button><Button variant="outline" className="h-12" onClick={() => edit(l, true)}>Renouveler</Button><Button className="h-12" disabled={busy || l.status !== "active" || data.billing.some((b) => b.license_id === l.id && b.starts_on === l.starts_on && b.ends_on === l.ends_on)} onClick={() => void action(() => prepare({ data: { licenseId: l.id } }), "Période ajoutée au suivi de facturation")}>Préparer la facturation</Button></div></article>)}{!licenses.length && <p className="py-8 text-muted-foreground">Aucune licence enregistrée pour le moment.</p>}</div></section>
    <section><div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto text-2xl">Suivi de facturation</h2><Button variant="outline" className="h-12" onClick={exportCsv} disabled={!bills.length}><Download />Exporter CSV</Button></div><p className="mt-2 text-sm text-muted-foreground">Une ligne par borne et par période annuelle ; références des factures émises hors plateforme.</p><div className="mt-4 divide-y border-y">{bills.map((b) => { const l = licenses.find((x) => x.id === b.license_id); return <article key={b.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{rs(l?.restaurant_id ?? "")?.name} · Borne {l?.kiosk_id}</h3><p className="text-sm text-muted-foreground">{date(b.starts_on)} → {date(b.ends_on)}</p><p className="mt-1 break-words text-sm">{billingLabels[b.status]}{b.invoice_reference && ` · ${b.invoice_reference}`}{b.due_on && ` · échéance ${date(b.due_on)}`}{b.paid_on && ` · règlement ${date(b.paid_on)}`}</p></div><p className="text-xl font-semibold tabular-nums">{money(b.amount_ht_cents)} HT</p><Button variant="outline" className="h-12" onClick={() => setBill({ ...b })}><Pencil />Suivre la facture</Button></article>; })}{!bills.length && <p className="py-8 text-muted-foreground">Aucune période de facturation préparée.</p>}</div></section>
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Modifier la licence" : "Ajouter une borne sous licence"}</DialogTitle></DialogHeader>{draft && <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await action(() => save({ data: draft }), "Licence enregistrée")) setDraft(null); }}>
      <div><Label htmlFor="license-restaurant">Restaurant</Label><select id="license-restaurant" className={selectClass + " mt-1"} disabled={editing || busy} value={draft.restaurantId} onChange={(e) => setDraft({ ...draft, restaurantId: e.target.value })}>{data.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="license-kiosk">Numéro de borne</Label><Input id="license-kiosk" className="h-12" required pattern="[a-z0-9-]{1,20}" maxLength={20} disabled={editing || busy} value={draft.kioskId} onChange={(e) => setDraft({ ...draft, kioskId: e.target.value.toLowerCase() })} /></div><div><Label htmlFor="license-label">Libellé</Label><Input id="license-label" className="h-12" maxLength={40} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div></div>
      <div><Label htmlFor="license-status">État de la licence</Label><select id="license-status" className={selectClass + " mt-1"} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}><option value="active">Active</option><option value="suspended">Suspendue</option><option value="ended">Terminée</option></select></div>
      <div><Label htmlFor="license-start">Début de la période annuelle</Label><Input id="license-start" className="h-12" type="date" required value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} /><p className="mt-2 text-sm text-muted-foreground">Fin : {draft.startsOn && /^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn) ? date(annualEnd(draft.startsOn)) : "—"} · 400 € HT</p></div>
      <div><Label htmlFor="license-notes">Notes</Label><Input id="license-notes" className="h-12" maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div><Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer la licence"}</Button>
    </form>}</DialogContent></Dialog>
    <Dialog open={bill !== null} onOpenChange={(open) => { if (!open && !busy) setBill(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Suivre la facture · 400 € HT</DialogTitle></DialogHeader>{bill && <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await action(() => saveBill({ data: { id: bill.id, status: bill.status as "to_invoice" | "invoiced" | "paid" | "cancelled", invoiceReference: bill.invoice_reference, dueOn: bill.due_on, paidOn: bill.paid_on, notes: bill.notes } }), "Suivi de facturation enregistré")) setBill(null); }}>
      <div><Label htmlFor="bill-status">État de facturation</Label><select id="bill-status" className={selectClass + " mt-1"} value={bill.status} onChange={(e) => setBill({ ...bill, status: e.target.value })}>{Object.entries(billingLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><Label htmlFor="bill-ref">Référence de facture</Label><Input id="bill-ref" className="h-12" required={bill.status === "invoiced" || bill.status === "paid"} maxLength={120} value={bill.invoice_reference} onChange={(e) => setBill({ ...bill, invoice_reference: e.target.value })} /></div>
      <div><Label htmlFor="bill-due">Échéance</Label><Input id="bill-due" className="h-12" type="date" value={bill.due_on ?? ""} onChange={(e) => setBill({ ...bill, due_on: e.target.value || null })} /></div>
      {bill.status === "paid" && <div><Label htmlFor="bill-paid">Date de règlement déclaré</Label><Input id="bill-paid" className="h-12" required type="date" value={bill.paid_on ?? ""} onChange={(e) => setBill({ ...bill, paid_on: e.target.value || null })} /></div>}
      <div><Label htmlFor="bill-notes">Notes</Label><Input id="bill-notes" className="h-12" maxLength={2000} value={bill.notes} onChange={(e) => setBill({ ...bill, notes: e.target.value })} /></div><Button className="h-12 w-full" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le suivi"}</Button>
    </form>}</DialogContent></Dialog>
  </main>;
}