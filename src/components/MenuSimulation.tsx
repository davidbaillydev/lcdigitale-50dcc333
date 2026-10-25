import { useMemo, useState } from "react";
import { FlaskConical, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ItemConfigurator } from "@/components/ItemDialog";
import { getCatalog } from "@/lib/catalogs";
import { withOptions, type OptionData } from "@/lib/menu-options";
import { euro, fromPrice, orderLine, type Category, type MenuItem } from "@/lib/menu";
import { itemImage } from "@/lib/menu-images";
import { simulateOrder, type SimulationLine, type SimulationOrder } from "@/lib/menu-simulation";

export function MenuSimulation({ open, onClose, menu, options, soldOut, name, dirty }: { open: boolean; onClose: () => void; menu: Category[]; options: OptionData; soldOut: Set<string>; name: string; dirty: boolean }) {
  const catalog = useMemo(() => withOptions(getCatalog({ menu_key: "vierge", menu: menu.map((c) => ({ ...c, items: c.items.filter((i) => !soldOut.has(i.id)) })) }), options), [menu, options, soldOut]);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [lines, setLines] = useState<SimulationLine[]>([]);
  const [orders, setOrders] = useState<SimulationOrder[]>([]);
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [note, setNote] = useState("");
  const validLines = lines.filter((l) => catalog.itemsById[l.itemId]);
  const total = validLines.reduce((sum, l) => { const product = catalog.itemsById[l.itemId]; return product ? sum + orderLine(product, l.sel, l.qty).total : sum; }, 0);
  const qty = (key: string, delta: number) => setLines((prev) => prev.map((l) => l.key === key ? { ...l, qty: l.qty + delta } : l).filter((l) => l.qty > 0));
  const submit = () => {
    try {
      const order = simulateOrder(catalog, validLines, orders.length + 1, note);
      setOrders((prev) => [order, ...prev]); setLines([]); setNote(""); setTab("orders");
      toast.success(`${order.id} créée sans paiement`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Test impossible"); }
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!value) { setItem(null); onClose(); } }}>
    <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:max-w-6xl">
      <DialogHeader className="shrink-0 border-b border-border p-4 pr-12">
        <DialogTitle className="flex items-center gap-2 text-2xl"><FlaskConical className="shrink-0 text-primary" /> Test du menu · {name}</DialogTitle>
        <DialogDescription>SIMULATION · Sans paiement · Hors cuisine et ventes · {dirty ? "Carte non publiée" : "Carte enregistrée"} · Historique temporaire</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 flex-wrap gap-2 px-4 pt-3">
        <Button variant={tab === "menu" ? "default" : "outline"} onClick={() => setTab("menu")}>Menu & panier</Button>
        <Button variant={tab === "orders" ? "default" : "outline"} onClick={() => setTab("orders")}>Commandes de test ({orders.length})</Button>
      </div>
      <div className="min-h-0 overflow-y-auto p-4">
        {tab === "menu" ? <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            {!catalog.categories.length && <p className="text-muted-foreground">Aucun plat disponible.</p>}
            {catalog.categories.map((category) => <section key={category.id}>
              <h2 className="mb-3 text-2xl">{category.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">{category.items.map((product) => {
                const image = itemImage(product, catalog.categories);
                return <article key={product.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                  {image && <img src={image.src} alt={image.real ? product.name : `Illustration pour ${product.name}`} className="h-32 w-full object-cover" loading="lazy" />}
                  <div className="space-y-2 p-3"><h3 className="break-words text-lg">{product.name}</h3>{product.desc && <p className="text-sm text-muted-foreground">{product.desc}</p>}
                    <Button variant="outline" className="w-full" aria-label={`Choisir ${product.name}`} onClick={() => setItem(product)}><Plus /> {fromPrice(product) !== null ? "Dès " : ""}{euro(fromPrice(product) ?? product.price)}</Button>
                  </div>
                </article>;
              })}</div>
            </section>)}
          </div>
          <aside className="min-w-0 space-y-4" aria-label="Panier de test">
            <h2 className="flex items-center gap-2 text-2xl"><ShoppingBag /> Panier de test</h2>
            {!validLines.length && <p className="text-muted-foreground">Votre panier est vide.</p>}
            {validLines.map((line) => { const product = catalog.itemsById[line.itemId]; if (!product) return null; const detail = orderLine(product, line.sel, line.qty); return <div key={line.key} className="space-y-2 border-b border-border pb-3">
              <div className="flex justify-between gap-2"><strong className="min-w-0 break-words">{product.name}{detail.size ? ` · ${detail.size.name}` : ""}</strong><span className="shrink-0">{euro(detail.total)}</span></div>
              <OrderOptions item={detail} />
              <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label={`Retirer un ${product.name}`} onClick={() => qty(line.key, -1)}><Minus /></Button><span className="w-6 text-center">{line.qty}</span><Button size="icon" variant="outline" aria-label={`Ajouter un ${product.name}`} onClick={() => qty(line.key, 1)}><Plus /></Button></div>
            </div>; })}
            <label className="block space-y-2 text-sm font-semibold">Remarques de test<Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
            <div className="flex justify-between text-xl font-semibold"><span>Total articles</span><span>{euro(total)}</span></div>
            <Button className="w-full" disabled={!validLines.length} onClick={submit}><FlaskConical /> Valider sans payer</Button>
            {!!lines.length && <Button variant="ghost" onClick={() => setLines([])}><Trash2 /> Vider le panier</Button>}
          </aside>
        </div> : <div className="space-y-4">
          {!orders.length && <p className="text-muted-foreground">Aucune commande de test.</p>}
          {orders.map((order) => <article key={order.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl">{order.id} · SIMULATION</h2><time className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString("fr-FR")}</time></div>
            {order.items.map((line, i) => <div key={i} className="border-t border-border pt-2"><div className="flex justify-between gap-3"><strong className="min-w-0 break-words">{line.qty}x {line.name}{line.size ? ` · ${line.size.name}` : ""}</strong><span className="shrink-0">{euro(line.total)}</span></div><OrderOptions item={line} /></div>)}
            {order.note && <p className="border-l-2 border-primary pl-3">{order.note}</p>}
            <div className="flex justify-between border-t border-border pt-3 text-xl font-semibold"><span>Total articles</span><span>{euro(order.total)}</span></div>
            <p className="text-sm text-muted-foreground">Aucun paiement · Non envoyée à la cuisine</p>
          </article>)}
        </div>}
      </div>
      <ItemConfigurator item={item} catalog={catalog} onClose={() => setItem(null)} onAdd={(itemId, sel, count) => { const key = itemId + JSON.stringify(sel); setLines((prev) => { const existing = prev.some((l) => l.key === key); return existing ? prev.map((l) => l.key === key ? { ...l, qty: l.qty + count } : l) : [...prev, { key, itemId, sel, qty: count }]; }); }} />
    </DialogContent>
  </Dialog>;
}

function OrderOptions({ item }: { item: SimulationOrder["items"][number] }) {
  return <div className="text-sm text-muted-foreground">{item.details.map((detail, i) => <p key={i}>{detail}</p>)}{item.selected_options?.map((option) => <p key={option.id}>{option.group ? `${option.group} : ` : ""}{option.name}{option.price ? ` (+${euro(option.price)})` : ""}</p>)}</div>;
}