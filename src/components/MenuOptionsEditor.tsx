// Back-office : groupes de suppléments (par restaurant) et tailles / formats + rattachement (par plat).
import { useState } from "react";
import { Copy, PackageX, Plus, Trash2, Layers, Ruler } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { euro } from "@/lib/menu";
import type { OptionData } from "@/lib/menu-options";
import { OptionSortableList } from "./OptionSortableList";

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Modification impossible");
async function run(p: PromiseLike<{ error: { message: string } | null }>) { const { error } = await p; if (error) throw new Error(error.message); }
const num = (v: string) => Math.max(0, Math.round(Number(v.replace(",", ".")) * 100) / 100 || 0);
const nextOrder = (rows: { sort_order: number }[]) => Math.max(-1, ...rows.map((r) => r.sort_order)) + 1;
async function reorder(table: "option_groups" | "option_items" | "product_variants", rows: { id: string }[], restaurantId: string, reload: () => void, scope?: { column: "group_id" | "product_id"; id: string }) {
  try {
    await Promise.all(rows.map((row, sort_order) => {
      if (table === "option_items" && scope?.column === "group_id") return run(supabase.from("option_items").update({ sort_order }).eq("id", row.id).eq("restaurant_id", restaurantId).eq("group_id", scope.id));
      if (table === "product_variants" && scope?.column === "product_id") return run(supabase.from("product_variants").update({ sort_order }).eq("id", row.id).eq("restaurant_id", restaurantId).eq("product_id", scope.id));
      return run(supabase.from("option_groups").update({ sort_order }).eq("id", row.id).eq("restaurant_id", restaurantId));
    }));
    toast.success("Ordre enregistré");
  } catch (e) { fail(e); throw e; }
  finally { reload(); }
}

/** Section « Groupes de suppléments & options » de la page Carte. */
export function OptionGroupsPanel({ restaurantId, data, reload }: { restaurantId: string; data: OptionData; reload: () => void }) {
  const [name, setName] = useState("");
  const act = (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => run(p).then(() => { if (ok) toast.success(ok); reload(); }).catch((e) => { fail(e); });
  const open = !data.groups.length;

  return (
    <details className="group/details mt-6 rounded-xl border border-border bg-card p-4" aria-labelledby="opt-groups" open={open}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-2xl font-semibold">
        <Layers className="h-5 w-5 text-primary" />
        <span id="opt-groups">Groupes de suppléments & options</span>
        <span className="text-sm text-muted-foreground">{data.groups.length ? `${data.groups.length} groupe(s)` : "aucun groupe"}</span>
        <span className="ml-auto text-sm font-medium text-primary group-details-open:hidden">{data.groups.length ? "Afficher" : "Créer un groupe"}</span>
        <span className="ml-auto hidden text-sm font-medium text-primary group-details-open:block">Masquer</span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">Créez vos groupes (ex. « Extra fromages », « Sauces »), puis rattachez-les aux plats dans leur fiche. Effet immédiat sur le site, la borne et le menu QR.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return; void act(supabase.from("option_groups").insert({ restaurant_id: restaurantId, name: name.trim(), sort_order: nextOrder(data.groups) }), "Groupe créé"); setName(""); }}>
        <Input className="min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe (ex. Extra fromages)" aria-label="Nom du nouveau groupe" maxLength={80} />
        <Button type="submit" className="min-h-12"><Plus /> Créer le groupe</Button>
      </form>
      <div className="mt-4 space-y-3">
        <OptionSortableList items={data.groups} label="Ordre des groupes de suppléments" onReorder={(rows) => reorder("option_groups", rows, restaurantId, reload)}>
          {(g) => <GroupCard g={g} items={data.items.filter((i) => i.group_id === g.id)} uses={new Set(data.links.filter((l) => l.group_id === g.id).map((l) => l.product_id)).size} restaurantId={restaurantId} act={act} reload={reload} />}
        </OptionSortableList>
        {!data.groups.length && <p className="text-sm text-muted-foreground">Aucun groupe pour l'instant.</p>}
      </div>
    </details>
  );
}

function GroupCard({ g, items, uses, restaurantId, act, reload }: { g: OptionData["groups"][number]; items: OptionData["items"]; uses: number; restaurantId: string; reload: () => void; act: (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<void> }) {
  const [label, setLabel] = useState(""); const [price, setPrice] = useState("");
  const upd = (patch: { name?: string; is_required?: boolean; min_selection?: number; max_selection?: number }) => act(supabase.from("option_groups").update(patch).eq("id", g.id));
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input defaultValue={g.name} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && upd({ name: e.target.value.trim() })} aria-label="Nom du groupe" />
        <Button variant="ghost" className="min-h-12" title="Dupliquer le groupe et ses suppléments" onClick={async () => {
          try {
            const { data: ng, error } = await supabase.from("option_groups").insert({ restaurant_id: restaurantId, name: `${g.name} (copie)`, is_required: g.is_required, min_selection: g.min_selection, max_selection: g.max_selection, sort_order: g.sort_order + 1 }).select("id").single();
            if (error) throw new Error(error.message);
            if (items.length) await run(supabase.from("option_items").insert(items.map((i) => ({ group_id: ng.id, restaurant_id: restaurantId, name: i.name, price: i.price, is_available: i.is_available, sort_order: i.sort_order }))));
            toast.success(`Groupe « ${g.name} » dupliqué`); reload();
          } catch (e) { fail(e); }
        }}><Copy /> Dupliquer</Button>
        <Button variant="ghost" className="min-h-12 text-destructive" onClick={() => confirm(`Supprimer le groupe « ${g.name} » ?`) && act(supabase.from("option_groups").delete().eq("id", g.id), "Groupe supprimé")}><Trash2 /> Supprimer</Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={g.is_required} onChange={(e) => upd({ is_required: e.target.checked, min_selection: e.target.checked ? Math.max(1, g.min_selection) : 0 })} /> Obligatoire</label>
        <label className="flex items-center gap-2">Min <Input type="number" min={0} max={20} className="w-20" defaultValue={g.min_selection} onBlur={(e) => upd({ min_selection: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <label className="flex items-center gap-2">Max <Input type="number" min={1} max={20} className="w-20" defaultValue={g.max_selection} onBlur={(e) => upd({ max_selection: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <span className="text-muted-foreground">Rattaché à {uses} plat(s)</span>
      </div>
      <div className="mt-3">
        <OptionSortableList items={items} label={`Suppléments de ${g.name}`} onReorder={(rows) => reorder("option_items", rows, restaurantId, reload, { column: "group_id", id: g.id })}>
          {(i) => <div className={`grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto_auto] ${i.is_available ? "" : "opacity-60"}`}>
            <Input defaultValue={i.name} onBlur={(e) => e.target.value.trim() && e.target.value !== i.name && act(supabase.from("option_items").update({ name: e.target.value.trim() }).eq("id", i.id))} aria-label="Nom du supplément" />
            <Input inputMode="decimal" defaultValue={i.price} onBlur={(e) => num(e.target.value) !== i.price && act(supabase.from("option_items").update({ price: num(e.target.value) }).eq("id", i.id))} aria-label="Prix du supplément en euros" />
            <Button size="sm" variant={i.is_available ? "outline" : "destructive"} className="min-h-11" onClick={() => act(supabase.from("option_items").update({ is_available: !i.is_available }).eq("id", i.id), i.is_available ? `${i.name} : épuisé` : `${i.name} : disponible`)}><PackageX /> {i.is_available ? "Épuiser" : "Épuisé"}</Button>
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => act(supabase.from("option_items").delete().eq("id", i.id))} aria-label={`Supprimer ${i.name}`}><Trash2 /></Button>
          </div>}
        </OptionSortableList>
      </div>
      <form className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto]" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; void act(supabase.from("option_items").insert({ group_id: g.id, restaurant_id: restaurantId, name: label.trim(), price: num(price), sort_order: nextOrder(items) })); setLabel(""); setPrice(""); }}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ingrédient (ex. Extra cheddar)" aria-label="Nouvel ingrédient" maxLength={80} />
        <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="+ €" aria-label="Prix du nouvel ingrédient" />
        <Button type="submit" variant="secondary" className="min-h-11"><Plus /> Ajouter</Button>
      </form>
    </div>
  );
}

/** Bloc « Tailles / formats & suppléments » dans la fiche d'un plat. */
export function ItemOptionsEditor({ restaurantId, productId, data, reload }: { restaurantId: string; productId: string; data: OptionData; reload: () => void }) {
  const sizes = data.variants.filter((v) => v.product_id === productId);
  const links = data.links.filter((l) => l.product_id === productId);
  const [nm, setNm] = useState(""); const [pr, setPr] = useState("");
  const act = (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => run(p).then(() => { if (ok) toast.success(ok); reload(); }).catch((e) => { fail(e); });
  const scopeOf = (gid: string) => links.filter((l) => l.group_id === gid);
  const setScope = async (gid: string, scope: string) => {
    try {
      await run(supabase.from("product_option_groups").delete().eq("product_id", productId).eq("group_id", gid).eq("restaurant_id", restaurantId));
      if (scope !== "none") await run(supabase.from("product_option_groups").insert({ restaurant_id: restaurantId, product_id: productId, group_id: gid, variant_id: scope === "all" ? null : scope }));
      reload();
    } catch (e) { fail(e); }
  };
  return (
    <details className="rounded-md border border-border p-2">
      <summary className="cursor-pointer text-xs font-semibold"><Ruler className="mr-1 inline h-3.5 w-3.5" />Tailles / formats & suppléments · {sizes.length ? `${sizes.length} taille(s)` : "prix unique"} · {new Set(links.map((l) => l.group_id)).size} groupe(s)</summary>
      <div className="mt-2 space-y-3">
        <div>
          <p className="text-xs font-semibold">Tailles / formats {sizes.length ? "(choix obligatoire pour le client ; le prix de la taille remplace le prix de base)" : "— ajoutez-en pour vendre par taille (Solo, XL…)"}</p>
          <div className="mt-1">
            <OptionSortableList items={sizes} label="Ordre des tailles et formats" onReorder={(rows) => reorder("product_variants", rows, restaurantId, reload, { column: "product_id", id: productId })}>
              {(s) => <div className={`grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto_auto] ${s.is_available ? "" : "opacity-60"}`}>
                <Input defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && act(supabase.from("product_variants").update({ name: e.target.value.trim() }).eq("id", s.id))} aria-label="Nom de la taille" />
                <Input inputMode="decimal" defaultValue={s.price} onBlur={(e) => num(e.target.value) !== s.price && act(supabase.from("product_variants").update({ price: num(e.target.value) }).eq("id", s.id))} aria-label="Prix de la taille en euros" />
                <Button size="sm" variant={s.is_available ? "outline" : "destructive"} className="min-h-11" onClick={() => act(supabase.from("product_variants").update({ is_available: !s.is_available }).eq("id", s.id))}><PackageX /> {s.is_available ? "Épuiser" : "Épuisé"}</Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => act(supabase.from("product_variants").delete().eq("id", s.id))} aria-label={`Supprimer la taille ${s.name}`}><Trash2 /></Button>
              </div>}
            </OptionSortableList>
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
            <Input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Taille (ex. XL)" aria-label="Nouvelle taille" maxLength={40} />
            <Input value={pr} onChange={(e) => setPr(e.target.value)} inputMode="decimal" placeholder="Prix €" aria-label="Prix de la nouvelle taille" />
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => { if (!nm.trim()) return; void act(supabase.from("product_variants").insert({ restaurant_id: restaurantId, product_id: productId, name: nm.trim(), price: num(pr), sort_order: nextOrder(sizes), is_default: !sizes.length })); setNm(""); setPr(""); }}><Plus /> Taille</Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold">Groupes de suppléments rattachés</p>
          {!data.groups.length && <p className="text-xs text-muted-foreground">Créez d'abord un groupe dans « Groupes de suppléments & options ».</p>}
          <ul className="mt-1 space-y-1">
            {data.groups.map((g) => {
              const cur = scopeOf(g.id);
              const value = !cur.length ? "none" : cur.some((l) => !l.variant_id) ? "all" : cur[0]?.variant_id ?? "none";
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={value !== "none"} onChange={(e) => void setScope(g.id, e.target.checked ? "all" : "none")} /> {g.name} <span className="text-xs text-muted-foreground">({data.items.filter((i) => i.group_id === g.id).map((i) => `${i.name}${i.price ? ` +${euro(i.price)}` : ""}`).join(", ") || "vide"})</span></label>
                  {value !== "none" && sizes.length > 0 && (
                    <select className="min-h-11 rounded-md border border-input bg-background px-2 text-sm" value={value} onChange={(e) => void setScope(g.id, e.target.value)} aria-label={`Taille concernée par ${g.name}`}>
                      <option value="all">Toutes les tailles</option>
                      {sizes.map((s) => <option key={s.id} value={s.id}>Taille {s.name} uniquement</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </details>
  );
}
