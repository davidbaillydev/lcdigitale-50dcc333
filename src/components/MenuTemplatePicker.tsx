import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyStructure, type MenuTemplate, type StructureMapping } from "@/lib/menu-templates";
import type { Category } from "@/lib/menu";

export function MenuTemplatePicker({ templates, menu, onApply, disabled = false }: { templates: MenuTemplate[]; menu: Category[]; onApply: (menu: Category[], count: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [mappings, setMappings] = useState<StructureMapping[]>([]);
  const [prices, setPrices] = useState(false);
  const [organize, setOrganize] = useState(false);
  const template = templates.find((t) => t.id === templateId);
  const result = template ? applyStructure(menu, template.structure, mappings, prices, organize) : null;
  return <>
    <Button variant="outline" disabled={disabled || !menu.some((c) => c.items.length) || !templates.length} onClick={() => { setMappings([]); setTemplateId(""); setPrices(false); setOrganize(false); setOpen(true); }}><Layers /> Appliquer un modèle de structure</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[85dvh] flex-col overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Structure de la carte</DialogTitle><DialogDescription>Les noms et prix des plats sont conservés. Choisissez le plat modèle pour chaque produit à configurer. Les changements restent dans le brouillon.</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm font-semibold">Modèle<select aria-label="Modèle de restaurant" className="min-h-12 w-full rounded-md border border-input bg-background px-3" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setMappings([]); }}><option value="">Choisir un modèle</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {template && <>
        <div className="space-y-2 border-y border-border py-3">
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={organize} onChange={(e) => setOrganize(e.target.checked)} />Reprendre les catégories et leur ordre pour les plats sélectionnés</label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={prices} onChange={(e) => setPrices(e.target.checked)} />Reprendre les prix des formats et suppléments du modèle</label>
          <p className="text-xs text-muted-foreground">Sans reprise des prix : chaque format garde le prix du plat importé ; suppléments à 0 €, à vérifier avant publication.</p>
        </div>
        <div className="space-y-4">{menu.map((c) => <div key={c.id}><h3 className="mb-2 font-semibold">{c.label}</h3>{c.items.map((i) => {
          const sourceId = mappings.find((m) => m.itemId === i.id)?.sourceId ?? "";
          const source = template.structure.flatMap((c) => c.items).find((s) => s.id === sourceId);
          return <div key={i.id} className="grid gap-2 border-b border-border py-3 sm:grid-cols-2"><span className="min-w-0 text-sm">{i.name} · {i.price.toFixed(2)} €</span><div className="min-w-0 space-y-1"><select aria-label={`Structure pour ${i.name}`} className="min-h-12 w-full rounded-md border border-input bg-background px-2 text-sm" value={sourceId} onChange={(e) => setMappings((prev) => [...prev.filter((m) => m.itemId !== i.id), { itemId: i.id, sourceId: e.target.value }])}><option value="">Ne pas modifier</option>{template.structure.map((cat) => <optgroup key={cat.id} label={cat.label}>{cat.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}</select>{source && <p className="text-xs text-muted-foreground">{source.options?.map((g) => `${g.label} : ${g.choices.map((ch) => ch.label).join(", ")}`).join(" · ") || "Aucun choix configurable"}</p>}</div></div>;
        })}</div>)}</div>
      </>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-background pt-3"><Button disabled={!result?.applied} onClick={() => { if (!result) return; onApply(result.menu, result.applied); setOpen(false); }}><Layers />Appliquer à {result?.applied ?? 0} plat(s)</Button><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button></div>
    </DialogContent></Dialog>
  </>;
}