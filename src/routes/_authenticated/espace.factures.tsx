import { FeatureOff } from "@/components/FeatureGate";
import { useStaff } from "@/hooks/use-staff";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Archive, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/lib/theme";
import { downloadCSV, downloadXLSX, eur } from "@/lib/export";
import { breakdown, effectiveBuyer, type B2BBuyer, type Invoice, type InvoiceData } from "@/lib/invoice";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { updateInvoiceBuyer } from "@/lib/invoice.functions";
import { invoicePlatformReadiness } from "@/lib/invoice-platform";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPdpStatuses, savePdpConfig, PDP_PROVIDERS, type PdpStatus } from "@/lib/pdp.functions";

export const Route = createFileRoute("/_authenticated/espace/factures")({
  head: () => ({
    meta: [
      { title: "Factures émises — LC Digitale" },
      { name: "description", content: "Liste des factures Factur-X, téléchargement PDF, archive ZIP et export comptable HT/TVA/TTC." },
      { property: "og:title", content: "Factures émises" },
      { property: "og:description", content: "Factures Factur-X et export comptable." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Invoices,
});

type Row = Invoice & { buyer_b2b: B2BBuyer | null; buyer_b2b_updated_at: string | null; id: string; restaurant_id: string; restaurants: { name: string } | null };
const month = () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

function Invoices() {
  const [from, setFrom] = useState(month());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rest, setRest] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparation, setPreparation] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [blocked, setBlocked] = useState<{ row: Row; errors: { msg: string; fix: "invoice" | "pdp" }[] } | null>(null);
  const fetchPdp = useServerFn(getPdpStatuses);
  const staff = useStaff();
  const allowed = staff.isAgency ? null : new Set(staff.restaurants.filter((r) => r.features.facturx && r.role !== "kitchen").map((r) => r.id));
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["invoices", from, to],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurant_invoices").select("id, restaurant_id, number, issued_at, data, buyer_b2b, buyer_b2b_updated_at, restaurants(name)")
        .gte("issued_at", from).lt("issued_at", new Date(new Date(to).getTime() + 864e5).toISOString()).order("issued_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const data = useMemo(() => (allowed ? raw.filter((r) => allowed.has(r.restaurant_id)) : raw), [raw, allowed && [...allowed].join()]);
  const names = useMemo(() => [...new Map(data.map((r) => [r.restaurant_id, r.restaurants?.name ?? ""])).entries()], [data]);
  const ids = names.map(([id]) => id);
  const { data: pdp = [] } = useQuery({ queryKey: ["pdp", ids], enabled: ids.length > 0, queryFn: () => fetchPdp({ data: { restaurantIds: ids } }) });
  const download = async (r: Row) => {
    const b = effectiveBuyer(r);
    const isB2B = !!(r.buyer_b2b || b.siren);
    if (isB2B) {
      const errors: { msg: string; fix: "invoice" | "pdp" }[] = [];
      if (!/^\d{9}$/.test(b.siren ?? "")) errors.push({ msg: "Le numéro SIREN du client professionnel est manquant.", fix: "invoice" });
      const x = r.buyer_b2b;
      const addrOk = x ? !!(x.address.trim() && /^\d{5}$/.test(x.postalCode) && x.city.trim()) : b.address.trim().length > 5;
      if (!addrOk) errors.push({ msg: "L'adresse de facturation électronique du client est incomplète.", fix: "invoice" });
      if (!pdp.find((p) => p.restaurantId === r.restaurant_id)?.complete) errors.push({ msg: "Le raccordement PDP n'est pas configuré dans vos paramètres.", fix: "pdp" });
      if (errors.length) { setBlocked({ row: r, errors }); return; }
    }
    const { downloadInvoice } = await import("@/lib/invoice"); await downloadInvoice(r);
  };
  const list = rest ? data.filter((r) => r.restaurant_id === rest) : data;
  const accounting = () => list.map((r) => {
    const d = r.data as InvoiceData; const bd = breakdown(d); const at = (x: number) => bd.find((b) => b.rate === x);
    return { Numéro: r.number, Date: r.issued_at.slice(0, 10), Établissement: r.restaurants?.name ?? "", Client: effectiveBuyer(r).name, "SIREN client": effectiveBuyer(r).siren ?? "", Commande: d.orderNumber,
      "HT 5,5%": at(5.5)?.ht ?? 0, "TVA 5,5%": at(5.5)?.vat ?? 0, "HT 10%": at(10)?.ht ?? 0, "TVA 10%": at(10)?.vat ?? 0, "HT 20%": at(20)?.ht ?? 0, "TVA 20%": at(20)?.vat ?? 0,
      "Total HT": d.totalHT, "Total TVA": d.totalVAT, "Total TTC": d.totalTTC, Paiement: d.paymentLabel ?? d.paymentMethod, Statut: d.paid ? "Payée" : "À régler" };
  });
  const total = list.reduce((s, r) => s + Number((r.data as InvoiceData).totalTTC), 0);

  if (!staff.loading && allowed && allowed.size === 0) return <FeatureOff feature="facturx" />;
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <Crumbs page="Factures" />
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto"><p className="text-sm font-semibold text-primary">Facturation électronique</p><h1 className="text-5xl">Factures</h1></div>
        <ThemeToggle />
      </header>
      <p role="status" className="border-l-4 border-primary pl-3 text-sm text-muted-foreground">Plateforme agréée : non raccordée. Le téléchargement PDF ne vaut pas transmission fiscale B2B.</p>
      <div id="pdp-config" className="grid gap-4 md:grid-cols-2">{names.length ? names.map(([id, n]) => <PdpCard key={id} restaurantId={id} name={n} status={pdp.find((p) => p.restaurantId === id)} />) : <p className="text-sm text-muted-foreground">La configuration PDP apparaît dès qu'une facture est émise pour un établissement.</p>}</div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="text-sm">Du <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Au <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {names.length > 1 && <label className="text-sm">Établissement <select className="block min-h-10 rounded-md border border-input bg-background px-2" value={rest} onChange={(e) => setRest(e.target.value)}><option value="">Tous</option>{names.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!list.length} onClick={() => downloadCSV(`factures-${from}-${to}`, accounting())}><FileDown /> CSV</Button>
          <Button variant="secondary" disabled={!list.length} onClick={() => downloadXLSX(`factures-${from}-${to}`, { Ventes: accounting() })}><FileSpreadsheet /> Excel</Button>
          <Button disabled={!list.length || busy} onClick={async () => {
            setBusy(true);
            try {
              const [{ default: JSZip }, { buildInvoicePdf }] = await Promise.all([import("jszip"), import("@/lib/invoice")]);
              const zip = new JSZip();
              for (const r of list) zip.file(`${r.number}.pdf`, await buildInvoicePdf(r));
              const blob = await zip.generateAsync({ type: "blob" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `factures-${from}-${to}.zip`; a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}><Archive /> {busy ? "Préparation…" : "Archive ZIP"}</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{list.length} facture(s) · {eur(total)} TTC</p>
      {isLoading ? <p>Chargement…</p> : !list.length ? <p className="text-muted-foreground">Aucune facture sur la période. Les factures sont émises depuis l'écran Cuisine ou par le client sur sa page de suivi.</p> : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {list.map((r) => { const d = r.data as InvoiceData; return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="font-semibold">{r.number}</p><p className="text-sm text-muted-foreground">{new Date(r.issued_at).toLocaleDateString("fr-FR")} · {r.restaurants?.name} · {effectiveBuyer(r).name}{effectiveBuyer(r).siren ? ` (SIREN ${effectiveBuyer(r).siren})` : ""} · cmd n° {d.orderNumber}</p></div>
              <span className="text-sm">{eur(Number(d.totalTTC))}</span>
              <Button size="sm" variant="outline" className="min-h-12" onClick={() => setEditing(r)}>{effectiveBuyer(r).siren ? "Client pro" : "Ajouter client pro"}</Button>
              <Button size="sm" variant="outline" className="min-h-12" onClick={() => setPreparation(r)}>Préparation B2B</Button>
              <Button size="sm" variant="secondary" className="min-h-12" onClick={() => download(r)}><FileText /> Télécharger</Button>
            </div>
          ); })}
        </div>
      )}
      <Dialog open={!!blocked} onOpenChange={(o) => { if (!o) setBlocked(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Prérequis Factur-X manquants</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Facture {blocked?.row.number} : téléchargement PDF/A-3 + XML bloqué.</p>
          <ul className="space-y-2">{blocked?.errors.map((e) => <li key={e.msg} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />{e.msg}</li>)}</ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setBlocked(null)}>Fermer</Button>
            <Button className="min-h-11" onClick={() => { const b = blocked!; setBlocked(null); if (b.errors.some((e) => e.fix === "invoice")) setEditing(b.row); else document.getElementById("pdp-config")?.scrollIntoView({ behavior: "smooth" }); }}>Compléter les infos</Button>
          </div>
        </DialogContent>
      </Dialog>
      {editing && <B2BDialog row={editing} onClose={() => setEditing(null)} />}
      <Dialog open={!!preparation} onOpenChange={(open) => { if (!open) setPreparation(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Raccordement B2B · {preparation?.number}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Non raccordé — prérequis manquants</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">{preparation && invoicePlatformReadiness(preparation).missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function B2BDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const save = useServerFn(updateInvoiceBuyer);
  const qc = useQueryClient();
  const b = effectiveBuyer(row);
  const init: B2BBuyer = row.buyer_b2b ?? { company: b.siren ? b.name : "", siren: b.siren ?? "", vatNumber: b.vatNumber ?? "", address: "", postalCode: "", city: "", email: b.email };
  const [v, setV] = useState<B2BBuyer>(init);
  const [busy, setBusy] = useState(false);
  const f = (k: keyof B2BBuyer, label: string, extra: Record<string, unknown> = {}) => (
    <div className={k === "company" || k === "address" || k === "email" ? "sm:col-span-2" : ""}><Label htmlFor={`b2b-${k}`}>{label}</Label>
      <Input id={`b2b-${k}`} className="min-h-11" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: k === "siren" ? e.target.value.replace(/\D/g, "").slice(0, 9) : k === "vatNumber" ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value })} {...extra} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent><DialogHeader><DialogTitle>Client professionnel · {row.number}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">La facture émise reste figée. Ces informations sont ajoutées en complément, datées et attribuées à votre compte, puis reprises dans le PDF et le Factur-X.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {f("company", "Raison sociale *")}{f("siren", "SIREN (9 chiffres) *", { inputMode: "numeric" })}{f("vatNumber", "N° TVA intracom.")}
          {f("address", "Adresse de facturation *")}{f("postalCode", "Code postal *", { inputMode: "numeric", maxLength: 5 })}{f("city", "Ville *")}{f("email", "Email de facturation", { type: "email" })}
        </div>
        {row.buyer_b2b_updated_at && <p className="text-xs text-muted-foreground">Dernière modification : {new Date(row.buyer_b2b_updated_at).toLocaleString("fr-FR")}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose}>Annuler</Button>
          <Button className="min-h-11" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await save({ data: { invoiceId: row.id, buyer: v } }); toast.success("Client professionnel enregistré"); await qc.invalidateQueries({ queryKey: ["invoices"] }); onClose(); }
            catch (e) { const m = (e as Error).message; toast.error(m.startsWith("[") ? "Vérifiez les champs : SIREN 9 chiffres, code postal 5 chiffres, raison sociale et adresse." : m); }
            finally { setBusy(false); }
          }}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PdpCard({ restaurantId, name, status }: { restaurantId: string; name: string; status?: PdpStatus | undefined }) {
  const save = useServerFn(savePdpConfig);
  const qc = useQueryClient();
  const [provider, setProvider] = useState<string>(status?.provider ?? "");
  const [key, setKey] = useState("");
  const [mandate, setMandate] = useState(status?.mandateSigned ?? false);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(status);
  if (status !== seen) { setSeen(status); setProvider(status?.provider ?? ""); setMandate(status?.mandateSigned ?? false); }
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Raccordement PDP (Obligation 2026)<span className="block text-sm font-normal text-muted-foreground">{name}</span></CardTitle>
        {status?.complete ? <Badge className="bg-primary text-primary-foreground">Configuration complète</Badge> : <Badge variant="destructive">Non raccordé</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Plateforme agréée</Label>
          <Select value={provider} onValueChange={setProvider}><SelectTrigger className="min-h-11"><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{Object.entries(PDP_PROVIDERS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor={`pdp-${restaurantId}`}>Identifiant de compte / Clé API</Label>
          <Input id={`pdp-${restaurantId}`} type="password" autoComplete="off" className="min-h-11" placeholder={status?.accountHint ? `Enregistrée (${status.accountHint}) — laisser vide pour conserver` : ""} value={key} onChange={(e) => setKey(e.target.value)} /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><Switch checked={mandate} onCheckedChange={setMandate} /> Mandat de télétransmission signé</label>
        <p className="text-xs text-muted-foreground">La clé est stockée côté serveur et n'est jamais réaffichée. L'envoi automatique vers la plateforme n'est pas encore activé.</p>
        <Button className="min-h-11 w-full" disabled={busy || !provider} onClick={async () => {
          setBusy(true);
          try { await save({ data: { restaurantId, provider: provider as never, accountId: key || undefined, mandateSigned: mandate } }); setKey(""); toast.success("Configuration enregistrée"); await qc.invalidateQueries({ queryKey: ["pdp"] }); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? "Enregistrement…" : "Enregistrer la configuration"}</Button>
      </CardContent>
    </Card>
  );
}
