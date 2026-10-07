import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { describeSelections, euro, selectedExtras, unitPrice } from "@/lib/menu";

export function CartLines() {
  const { lines, setQty, catalog } = useCart();
  if (!lines.length) return <p className="py-10 text-center text-muted-foreground">Votre panier est vide.</p>;
  return (
    <ul className="divide-y divide-border">
      {lines.map((l) => {
        const item = catalog.itemsById[l.itemId];
        if (!item) return null;
        return (
          <li key={l.key} className="flex gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.name}{selectedExtras(item, l.sel).size ? ` — Taille ${selectedExtras(item, l.sel).size!.name}` : ""}</p>
              {describeSelections(item, l.sel).map((d) => (
                <p key={d} className="text-xs text-muted-foreground">{d}</p>
              ))}
              {selectedExtras(item, l.sel).selected_options.map((o) => (
                <p key={o.id} className="text-xs font-medium">+ {o.name}{o.price ? ` (+${euro(o.price)})` : ""}</p>
              ))}
              <p className="mt-1 text-sm text-primary">{euro(unitPrice(item, l.sel) * l.qty)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setQty(l.key, l.qty - 1)} aria-label="Retirer"><Minus /></Button>
              <span className="w-6 text-center text-sm">{l.qty}</span>
              <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setQty(l.key, l.qty + 1)} aria-label="Ajouter"><Plus /></Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CartSheet() {
  const { count, subtotal, restaurant } = useCart();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="relative font-semibold">
          <ShoppingBag /> Panier
          {count > 0 && <span className="ml-1 rounded-full bg-accent px-2 text-xs text-accent-foreground">{count}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display text-3xl">Votre panier</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto px-4"><CartLines /></div>
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex justify-between font-semibold"><span>Sous-total</span><span>{euro(subtotal)}</span></div>
          <Button asChild size="lg" className="w-full font-semibold" disabled={!count}>
            <Link to="/$slug/commande" params={{ slug: restaurant.slug }}>Commander</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
