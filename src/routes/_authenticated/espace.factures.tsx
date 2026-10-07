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
import { breakdown, type Invoice, type InvoiceData } from "@/lib/invoice";
import { invoicePlatformReadiness } from "@/lib/invoice-platform";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type Row = Invoice & { id: string; restaurant_id: string; restaurants: { name: string } | null };
const month = () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

function Invoices() {
  const [from, setFrom] = useState(month());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rest, setRest] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparation, setPreparation] = useState<Row | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["invoices", from, to],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurant_invoices").select("id, restaurant_id, number, issued_at, data, restaurants(name)")
        .gte("issued_at", from).lt("issued_at", new Date(new Date(to).getTime() + 864e5).toISOString()).order("issued_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const names = useMemo(() => [...new Map(data.map((r) => [r.restaurant_id, r.restaurants?.name ?? ""])).entries()], [data]);
  const list = rest ? data.filter((r) => r.restaurant_id === rest) : data;
  const accounting = () => list.map((r) => {
    const d = r.data as InvoiceData; const bd = breakdown(d); const at = (x: number) => bd.find((b) => b.rate === x);
    return { Numéro: r.number, Date: r.issued_at.slice(0, 10), Établissement: r.restaurants?.name ?? "", Client: d.buyer.name, Commande: d.orderNumber,
      "HT 5,5%": at(5.5)?.ht ?? 0, "TVA 5,5%": at(5.5)?.vat ?? 0, "HT 10%": at(10)?.ht ?? 0, "TVA 10%": at(10)?.vat ?? 0, "HT 20%": at(20)?.ht ?? 0, "TVA 20%": at(20)?.vat ?? 0,
      "Total HT": d.totalHT, "Total TVA": d.totalVAT, "Total TTC": d.totalTTC, Paiement: d.paymentLabel ?? d.paymentMethod, Statut: d.paid ? "Payée" : "À régler" };
  });
  const total = list.reduce((s, r) => s + Number((r.data as InvoiceData).totalTTC), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <Crumbs page="Factures" />
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto"><p className="text-sm font-semibold text-primary">Facturation électronique</p><h1 className="text-5xl">Factures</h1></div>
        <ThemeToggle />
      </header>
      <p role="status" className="border-l-4 border-primary pl-3 text-sm text-muted-foreground">Plateforme agréée : non raccordée. Le téléchargement PDF ne vaut pas transmission fiscale B2B.</p>
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
              <div className="min-w-0 flex-1"><p className="font-semibold">{r.number}</p><p className="text-sm text-muted-foreground">{new Date(r.issued_at).toLocaleDateString("fr-FR")} · {r.restaurants?.name} · {d.buyer.name} · cmd n° {d.orderNumber}</p></div>
              <span className="text-sm">{eur(Number(d.totalTTC))}</span>
               <Button size="sm" variant="outline" className="min-h-12" onClick={() => setPreparation(r)}>Préparation B2B</Button>
              <Button size="sm" variant="secondary" className="min-h-12" onClick={async () => { const { downloadInvoice } = await import("@/lib/invoice"); await downloadInvoice(r); }}><FileText /> PDF</Button>
            </div>
          ); })}
        </div>
      )}
      <Dialog open={!!preparation} onOpenChange={(open) => { if (!open) setPreparation(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Raccordement B2B · {preparation?.number}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Non raccordé — prérequis manquants</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">{preparation && invoicePlatformReadiness(preparation).missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
