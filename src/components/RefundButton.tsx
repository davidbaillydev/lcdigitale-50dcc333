import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { euro } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { listCreditNotes, refundOrder, REFUND_REASONS, type RefundReason } from "@/lib/refunds.functions";
import { downloadInvoice } from "@/lib/invoice";

type O = { id: string; total: number | string; payment_method: string; payment_status?: string; payment_ref?: string | null; refunded_amount?: number | string | null; items: { name: string; qty: number; total: number }[] };

const providerName = (ref?: string | null) => (ref?.startsWith("pi_") ? "Stripe" : ref?.startsWith("mollie:") ? "Mollie" : null);

/** Badge d'état de remboursement à afficher sur la commande. */
export function RefundBadge({ o }: { o: O }) {
  const done = Number(o.refunded_amount ?? 0);
  if (!done) return null;
  const full = o.payment_status === "refunded";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", full ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground")}>{full ? "Remboursé intégralement" : `Remboursé partiel (${euro(done)})`}</span>;
}

/** Bouton « Rembourser » + modale (total, partiel par montant ou par article) et accès aux avoirs. */
export function RefundButton({ o, onDone }: { o: O; onDone?: () => void }) {
  const provider = providerName(o.payment_ref);
  const refund = useServerFn(refundOrder);
  const list = useServerFn(listCreditNotes);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"full" | "amount" | "items">("full");
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState<number[]>([]);
  const [reason, setReason] = useState<RefundReason>("out_of_stock");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState("");
  const done = Number(o.refunded_amount ?? 0);
  const remaining = Math.round((Number(o.total) - done) * 100) / 100;
  if (o.payment_method !== "online" || !provider || !["paid", "partially_refunded", "refunded"].includes(o.payment_status ?? "")) return null;

  const value = kind === "full" ? remaining : kind === "items" ? items.reduce((s, i) => s + Number(o.items[i]?.total ?? 0), 0) : Number(amount.replace(",", "."));
  const valid = value > 0 && value <= remaining + 0.005;

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await refund({ data: { orderId: o.id, reason, requestKey: key, ...(kind === "items" ? { itemIndexes: items } : { amount: Math.round(value * 100) / 100 }) } });
      toast.success(`Remboursement de ${euro(r.amount)} effectué · avoir ${r.creditNote}`);
      setOpen(false); onDone?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Remboursement impossible"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" className="min-h-12 flex-1" disabled={remaining <= 0}
          onClick={() => { setKey(crypto.randomUUID()); setKind("full"); setAmount(""); setItems([]); setErr(""); setOpen(true); }}>
          <Undo2 /> {remaining <= 0 ? "Remboursée" : "Rembourser"}
        </Button>
        {done > 0 && (
          <Button size="sm" variant="secondary" className="min-h-12 flex-1" onClick={async () => {
            try { const notes = await list({ data: { orderId: o.id } }); for (const n of notes) await downloadInvoice(n); if (!notes.length) toast.error("Aucun avoir"); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Avoir indisponible"); }
          }}><FileText /> Avoir PDF</Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rembourser la commande</DialogTitle>
            <DialogDescription>Reste remboursable : {euro(remaining)}. Sera crédité sur la carte du client via {provider}. Un avoir Factur-X sera émis automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type de remboursement">
              {([["full", "Total"], ["amount", "Montant libre"], ["items", "Par article"]] as const).map(([v, l]) => (
                <Button key={v} type="button" role="radio" aria-checked={kind === v} variant={kind === v ? "default" : "outline"} className="min-h-12" onClick={() => setKind(v)}>{l}</Button>
              ))}
            </div>
            {kind === "amount" && (
              <div><Label htmlFor="refund-amount">Montant (€)</Label><Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining.toFixed(2)} /></div>
            )}
            {kind === "items" && (
              <ul className="space-y-1">
                {o.items.map((it, i) => (
                  <li key={i}><label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={items.includes(i)} onChange={(e) => setItems(e.target.checked ? [...items, i] : items.filter((x) => x !== i))} />
                    <span className="flex-1">{it.qty}× {it.name}</span><span>{euro(Number(it.total))}</span>
                  </label></li>
                ))}
              </ul>
            )}
            <div>
              <Label htmlFor="refund-reason">Motif</Label>
              <select id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                {Object.entries(REFUND_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {err && <p role="alert" className="rounded bg-destructive/20 p-3 text-sm">{err}</p>}
            <Button variant="destructive" size="lg" className="min-h-12 w-full" disabled={!valid || busy} onClick={submit}>
              {busy ? <><Loader2 className="animate-spin" /> Remboursement…</> : `Rembourser ${valid ? euro(value) : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
