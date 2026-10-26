// Aperçu d'un ticket thermique avant impression : vérifie catégories, suppléments et remarques.
import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ticketHtml, type TicketFieldsIn, type TicketKind, type TicketOrder, type TicketShop, type TicketWidth } from "@/lib/ticket";

type Props = {
  order: TicketOrder | null;
  kinds: TicketKind[];
  shop: TicketShop | string;
  width: TicketWidth;
  kitchen: Partial<TicketFieldsIn>;
  onClose: () => void;
  onPrint: (order: TicketOrder, kinds: TicketKind[]) => void;
};

const kindLabel = (k: TicketKind) => (k === "kitchen" ? "Ticket cuisine" : "Ticket caisse");

export function TicketPreviewDialog({ order, kinds, shop, width, kitchen, onClose, onPrint }: Props) {
  const html = useMemo(
    () => (order ? kinds.map((k) => ticketHtml(order, k, width, shop, kitchen)).join('<div style="page-break-before:always"></div>') : ""),
    [order, kinds, width, shop, kitchen],
  );
  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="kds-touch-dialog flex max-h-[92dvh] w-[min(96vw,560px)] flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu du ticket n° {order?.order_number}</DialogTitle>
          <DialogDescription>
            {kinds.map(kindLabel).join(" + ")} — vérifiez les catégories, les suppléments et la remarque client avant d'imprimer.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3">
          {order && (
            <iframe
              title={`Aperçu du ticket ${order.order_number}`}
              srcDoc={html}
              className="mx-auto block h-[60vh] rounded bg-white shadow"
              style={{ width: `${Math.min(width * 3.8, 400)}px` }}
              sandbox=""
            />
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="min-h-12" onClick={onClose}>Annuler</Button>
          <Button className="min-h-12" onClick={() => order && onPrint(order, kinds)}>
            <Printer aria-hidden="true" /> Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
