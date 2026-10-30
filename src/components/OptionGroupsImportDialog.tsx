import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { euro } from "@/lib/menu";
import { loadOptionData, EMPTY_OPTIONS, type OptionData } from "@/lib/menu-options";

/** Copie détachée de groupes de suppléments (et leurs suppléments) depuis un autre restaurant. Aucun rattachement aux plats n'est copié. */
export function OptionGroupsImportDialog({ restaurantId, existing, reload }: { restaurantId: string; existing: OptionData; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [source, setSource] = useState("");
  const [data, setData] = useState<OptionData>(EMPTY_OPTIONS);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase.from("restaurants").select("id, name, city").neq("id", restaurantId).order("name").then(({ data }) => setRestaurants(data ?? []));
  }, [open, restaurantId]);

  useEffect(() => {
    setPicked(new Set()); setData(EMPTY_OPTIONS);
    if (source) void loadOptionData(supabase, source).then(setData).catch(() => toast.error("Lecture impossible"));
  }, [source]);

  const groups = [...data.groups].sort((a, b) => a.sort_order - b.sort_order);
  const taken = new Set(existing.groups.map((g) => g.name.trim().toLowerCase()));

  async function copy() {
    setBusy(true);
    try {
      let order = Math.max(-1, ...existing.groups.map((g) => g.sort_order)) + 1;
      for (const g of groups.filter((x) => picked.has(x.id))) {
        const name = taken.has(g.name.trim().toLowerCase()) ? `${g.name} (import)` : g.name;
        const { data: ng, error } = await supabase.from("option_groups").insert({ restaurant_id: restaurantId, name, is_required: g.is_required, min_selection: g.min_selection, max_selection: g.max_selection, sort_order: order++ }).select("id").single();
        if (error || !ng) throw new Error(error?.message ?? "Création impossible");
        const items = data.items.filter((i) => i.group_id === g.id);
        if (items.length) {
          const { error: e2 } = await supabase.from("option_items").insert(items.map((i) => ({ group_id: ng.id, restaurant_id: restaurantId, name: i.name, price: i.price, is_available: i.is_available, sort_order: i.sort_order })));
          if (e2) throw new Error(e2.message);
        }
      }
      toast.success(`${picked.size} groupe(s) copié(s). Rattachez-les aux plats dans leur fiche.`);
      setOpen(false); setSource("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Copie impossible"); }
    finally { setBusy(false); reload(); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-12"><Download /> Importer d'un autre restaurant</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copier des groupes de suppléments</DialogTitle>
          <DialogDescription>Les groupes choisis et leurs suppléments sont copiés ici. Le restaurant source n'est pas modifié ; les rattachements aux plats restent à faire.</DialogDescription>
        </DialogHeader>
        <label className="text-sm font-medium" htmlFor="opt-src">Restaurant source</label>
        <select id="opt-src" className="min-h-12 w-full rounded-md border border-input bg-background px-3" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Choisir un restaurant…</option>
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}{r.city ? ` — ${r.city}` : ""}</option>)}
        </select>
        {source && (
          <div className="space-y-2">
            {groups.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(picked.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)))}>
                {picked.size === groups.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            )}
            {groups.map((g) => {
              const items = data.items.filter((i) => i.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <label key={g.id} className="flex min-h-12 cursor-pointer gap-3 rounded-lg border border-border p-3">
                  <Checkbox className="mt-1" checked={picked.has(g.id)} onCheckedChange={(v) => { const n = new Set(picked); if (v) n.add(g.id); else n.delete(g.id); setPicked(n); }} />
                  <span className="min-w-0">
                    <span className="font-medium">{g.name}</span>
                    {taken.has(g.name.trim().toLowerCase()) && <span className="ml-2 text-xs text-muted-foreground">(existe déjà, sera nommé « (import) »)</span>}
                    <span className="block text-xs text-muted-foreground">{g.is_required ? "Obligatoire" : "Facultatif"} · {g.min_selection}–{g.max_selection} choix · {items.length} supplément(s)</span>
                    <span className="block text-xs text-muted-foreground">{items.map((i) => `${i.name}${i.price ? ` (${euro(i.price)})` : ""}`).join(", ")}</span>
                  </span>
                </label>
              );
            })}
            {!groups.length && <p className="text-sm text-muted-foreground">Ce restaurant n'a aucun groupe de suppléments.</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="button" disabled={!picked.size || busy} onClick={copy}>{busy ? "Copie…" : `Copier ${picked.size || ""} groupe(s)`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
