import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketPreviewDialog } from "@/components/TicketPreviewDialog";
import { euro } from "@/lib/menu";
import { modeLabel, isPaid, type TicketOrder, type TicketShop, type TicketKind, type TicketWidth, type TicketFieldsIn } from "@/lib/ticket";
import { queryKitchenHistory } from "@/lib/kitchen-history";

type Props = {
  restaurantId: string; open: boolean; onClose: () => void;
  shop: TicketShop; width: TicketWidth; fields: TicketFieldsIn;
  onPrint: (order: TicketOrder, kinds: TicketKind[]) => Promise<void>;
};
type HistoricalOrder = TicketOrder & { id: string; status: string; created_at: string };
const statuses: Record<string, string> = { new: "Nouvelle", accepted: "En préparation", ready: "Prête", done: "Terminée", cancelled: "Annulée", pending_approval: "À valider" };

export function KitchenHistory({ restaurantId, open, onClose, shop, width, fields, onPrint }: Props) {
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
      <DialogContent className="flex max-h-[92dvh] max-w-3xl flex-col">
        <DialogHeader><DialogTitle>Ventes & tickets</DialogTitle><p className="text-sm text-muted-foreground">{shop.name}</p></DialogHeader>
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setPage(0); setFilters({ search: search.trim(), date }); }}>
          <div><Label htmlFor="history-search">N° de commande ou nom du client</Label><Input id="history-search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-12" /></div>
          <div><Label htmlFor="history-date">Date</Label><Input id="history-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" /></div>
          <Button type="submit" className="min-h-12"><Search /> Rechercher</Button>
        </form>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
          {history.isPending && <p role="status" className="py-8 text-center text-muted-foreground">Chargement…</p>}
          {history.isError && <div role="alert" className="py-6 text-center"><p>Impossible de charger les commandes.</p><Button variant="outline" onClick={() => void history.refetch()}>Réessayer</Button></div>}
          {history.data?.orders.map((o) => <article key={o.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-semibold">N° {o.order_number} · {o.customer_name}</h2><strong>{euro(Number(o.total))}</strong></div>
            <p className="mt-1 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · {statuses[o.status] ?? o.status} · {modeLabel(o.mode)} · {isPaid(o) ? "Payée" : "Non réglée"}</p>
            <p className="mt-2 break-words text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-12" onClick={() => setPreview({ order: o, kinds: ["kitchen"] })}><Printer /> Ticket cuisine</Button>
              <Button variant="secondary" className="min-h-12" onClick={() => setPreview({ order: o, kinds: ["receipt"] })}><Printer /> Ticket client</Button>
              <Button variant="outline" className="min-h-12" onClick={() => setPreview({ order: o, kinds: ["kitchen", "receipt"] })}><Printer /> Les deux tickets</Button>
            </div>
          </article>)}
          {history.data?.count === 0 && <p className="py-8 text-center text-muted-foreground">Aucune commande trouvée.</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">{history.data?.count ?? 0} commande(s) · Page {page + 1}</span>
          <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Page précédente" disabled={page === 0 || history.isFetching} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Page suivante" disabled={!history.data || (page + 1) * 30 >= history.data.count || history.isFetching} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <TicketPreviewDialog order={preview?.order ?? null} kinds={preview?.kinds ?? ["kitchen"]} shop={shop} width={width} kitchen={fields} onClose={() => setPreview(null)} onPrint={(order, kinds) => { setPreview(null); void onPrint(order, kinds); }} />
  </>;
}