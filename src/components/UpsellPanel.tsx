import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveUpsell } from "@/lib/restaurant-settings.functions";
import { getCatalog } from "@/lib/catalogs";
import { euro } from "@/lib/menu";
import type { Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX = 12;

export function UpsellPanel({ restaurant, onSaved }: { restaurant: Pick<Restaurant, "id" | "menu_key" | "menu" | "config">; onSaved?: () => void }) {
  const save = useServerFn(saveUpsell);
  const catalog = useMemo(() => getCatalog(restaurant), [restaurant]);
  const init = restaurant.config?.upsell;
  const [mode, setMode] = useState<"auto" | "manual">(init?.mode === "manual" ? "manual" : "auto");
  const [items, setItems] = useState<string[]>(init?.itemIds ?? []);
  const [cats, setCats] = useState<string[]>(init?.categoryIds ?? []);
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < MAX) set([...list, id]);
    else toast.error(`${MAX} éléments maximum`);
  };
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId: restaurant.id, upsell: { mode, itemIds: items, categoryIds: cats } } }); toast.success("Suggestions enregistrées"); onSaved?.(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const chip = (on: boolean) => cn("min-h-11 rounded-lg border px-3 py-2 text-left text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary");
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-3xl">Ventes suggestives</h2>
        <p className="text-sm text-muted-foreground">Articles proposés dans le panier, à la commande et sur la borne.</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode des suggestions">
        {(["auto", "manual"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={chip(mode === m)}>
            <span className="block font-semibold">{m === "auto" ? "Automatique" : "Manuel"}</span>
            <span className="block text-xs opacity-80">{m === "auto" ? "Boissons, desserts, sauces, accompagnements" : "Vos articles ou catégories mis en avant"}</span>
          </button>
        ))}
      </div>
      {mode === "manual" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Les articles choisis passent en priorité ; si aucun n'est disponible, la sélection automatique prend le relais.</p>
          <div>
            <p className="mb-2 font-semibold">Catégories entières ({cats.length})</p>
            <div className="flex flex-wrap gap-2">
              {catalog.categories.map((c) => <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggle(cats, setCats, c.id)} className={chip(cats.includes(c.id))}>{c.label}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold">Articles précis ({items.length}/{MAX})</p>
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {catalog.categories.map((c) => (
                <div key={c.id}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{c.label}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {c.items.map((i) => <button key={i.id} type="button" aria-pressed={items.includes(i.id)} onClick={() => toggle(items, setItems, i.id)} className={chip(items.includes(i.id))}>{i.name} · {euro(i.price)}</button>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <Button onClick={submit} disabled={busy} className="min-h-11">Enregistrer les suggestions</Button>
    </section>
  );
}
