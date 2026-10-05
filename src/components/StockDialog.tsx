import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PackageX } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getRestaurant } from "@/lib/restaurants.functions";
import { getCatalog } from "@/lib/catalogs";
import { setSoldOut, useSoldOut } from "@/lib/stock";
import type { Restaurant } from "@/lib/shop";

/** Ruptures temporaires depuis l'écran cuisine : le plat disparaît aussitôt du site, de la borne et du menu QR. */
export function StockDialog({ slug, restaurantId }: { slug: string; restaurantId: string }) {
  const fetchR = useServerFn(getRestaurant);
  const { data: r } = useQuery({ queryKey: ["stock-restaurant", slug], queryFn: () => fetchR({ data: { slug } }) });
  const soldOut = useSoldOut(restaurantId);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const cats = useMemo(() => (r ? getCatalog(r as unknown as Restaurant).categories : []), [r]);
  const needle = q.trim().toLowerCase();

  const toggle = async (id: string, name: string, on: boolean) => {
    setBusy(id);
    try { await setSoldOut(restaurantId, id, on); toast.success(on ? `${name} : en rupture` : `${name} : de nouveau disponible`); }
    catch { toast.error("Modification impossible, réessayez."); }
    finally { setBusy(null); }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary"><PackageX /> Ruptures{soldOut.size ? ` (${soldOut.size})` : ""}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[100dvh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Ruptures temporaires</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Un plat en rupture est retiré immédiatement du site, de la borne et du menu QR. Les commandes qui le contiennent sont refusées.</p>
        <Input placeholder="Rechercher un plat…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!r && <p className="py-6 text-center text-muted-foreground">Chargement…</p>}
        {cats.map((c) => {
          const items = c.items.filter((i) => !needle || i.name.toLowerCase().includes(needle));
          if (!items.length) return null;
          return (
            <section key={c.id}>
              <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</h3>
              <ul className="divide-y divide-border">
                {items.map((i) => {
                  const out = soldOut.has(i.id);
                  return (
                    <li key={i.id} className="flex min-h-12 items-center justify-between gap-3 py-1">
                      <label htmlFor={`so-${i.id}`} className={out ? "text-muted-foreground line-through" : ""}>{i.name}</label>
                      <span className="flex items-center gap-2 text-xs">
                        {out ? "Épuisé" : "Disponible"}
                        <Switch id={`so-${i.id}`} checked={!out} disabled={busy === i.id} onCheckedChange={(v) => toggle(i.id, i.name, !v)} aria-label={`${i.name} disponible`} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
