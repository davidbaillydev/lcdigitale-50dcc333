import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketPreviewDialog } from "@/components/TicketPreviewDialog";
import { RefundBadge, RefundButton } from "@/components/RefundButton";
import { euro } from "@/lib/menu";
import { modeLabel, isPaid, type TicketOrder, type TicketShop, type TicketKind, type TicketWidth, type TicketFieldsIn } from "@/lib/ticket";
import { queryKitchenHistory } from "@/lib/kitchen-history";

type Props = {
  restaurantId: string; open: boolean; onClose: () => void;
  shop: TicketShop; width: TicketWidth; fields: TicketFieldsIn;
  onPrint: (order: TicketOrder, kinds: TicketKind[]) => Promise<void>;
};
type HistoricalOrder = TicketOrder & { id: string; status: string; created_at: string; payment_ref: string | null; refund_status: string | null; refunded_amount: number | string | null };
const statuses: Record<string, string> = { new: "Nouvelle", accepted: "En préparation", ready: "Prête", done: "Terminée", cancelled: "Annulée", pending_approval: "À valider" };

export function KitchenHistory({ restaurantId, open, onClose, shop, width, fields, onPrint }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [filters, setFilters] = useState({ search: "", date: "" });
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ order: HistoricalOrder; kinds: TicketKind[] } | null>(null);
  const history = useQuery({
    queryKey: ["kitchen-history", restaurantId, filters, page], enabled: open,
    queryFn: async () => {
      const { data, error, count } = await queryKitchenHistory(supabase, restaurantId, filters, page);
      if (error) throw error;
      return { orders: (data ?? []) as unknown as HistoricalOrder[], count: count ?? 0 };
    }, staleTime: 30_000,
  });
  return <>
    <Dialog open={open && !preview} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="kds-touch-dialog flex max-h-[92dvh] max-w-4xl flex-col">
        <DialogHeader><DialogTitle>Ventes & tickets</DialogTitle><p className="text-sm text-muted-foreground">{shop.name}</p></DialogHeader>
        <form className="grid shrink-0 gap-3 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end lg:grid-cols-[minmax(0,1fr)_13rem_auto]" onSubmit={(e) => { e.preventDefault(); setPage(0); setFilters({ search: search.trim(), date }); }}>
          <div className="min-w-0 space-y-2"><Label htmlFor="history-search">N° de commande ou nom du client</Label><Input id="history-search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-14 text-base" /></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="history-date">Date</Label><Input id="history-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-14 max-w-full text-base" /></div>
          <Button type="submit" className="min-h-14 sm:col-span-2 lg:col-span-1"><Search /> Rechercher</Button>
        </form>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
          {history.isPending && <p role="status" className="py-8 text-center text-muted-foreground">Chargement…</p>}
          {history.isError && <div role="alert" className="py-6 text-center"><p>Impossible de charger les commandes.</p><Button variant="outline" onClick={() => void history.refetch()}>Réessayer</Button></div>}
          {history.data?.orders.map((o) => <article key={o.id} className="rounded-lg border border-border p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">N° {o.order_number} · {o.customer_name}</h2><strong className="shrink-0 whitespace-nowrap text-lg">{euro(Number(o.total))}</strong></div>
            <p className="mt-1 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · {statuses[o.status] ?? o.status} · {modeLabel(o.mode)} · {o.is_test ? "CB Test (Admin) · Aucun encaissement" : isPaid(o) ? "Payée" : "Non réglée"}</p>
            <div className="mt-2"><RefundBadge o={o} /></div>
            <p className="mt-2 break-words text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button variant="secondary" className="min-h-14 whitespace-normal" onClick={() => setPreview({ order: o, kinds: ["kitchen"] })}><Printer /> Ticket cuisine</Button>
              <Button variant="secondary" className="min-h-14 whitespace-normal" onClick={() => setPreview({ order: o, kinds: ["receipt"] })}><Printer /> Ticket client</Button>
              <Button variant="outline" className="min-h-14 whitespace-normal" onClick={() => setPreview({ order: o, kinds: ["kitchen", "receipt"] })}><Printer /> Les deux tickets</Button>
              {!o.is_test && <RefundButton o={o} actionClassName="min-h-14 whitespace-normal text-sm" onDone={() => { void queryClient.invalidateQueries({ queryKey: ["kitchen-history", restaurantId] }); }} />}
            </div>
          </article>)}
          {history.data?.count === 0 && <p className="py-8 text-center text-muted-foreground">Aucune commande trouvée.</p>}
        </div>
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">{history.data?.count ?? 0} commande(s) · Page {page + 1}</span>
          <div className="flex shrink-0 gap-3"><Button variant="outline" size="icon" className="h-14 w-14" aria-label="Page précédente" disabled={page === 0 || history.isFetching} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" className="h-14 w-14" aria-label="Page suivante" disabled={!history.data || (page + 1) * 30 >= history.data.count || history.isFetching} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <TicketPreviewDialog order={preview?.order ?? null} kinds={preview?.kinds ?? ["kitchen"]} shop={shop} width={width} kitchen={fields} onClose={() => setPreview(null)} onPrint={(order, kinds) => { setPreview(null); void onPrint(order, kinds); }} />
  </>;
}