import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Gift, Tag, Trash2, Pencil } from "lucide-react";
import { deletePromo, listPromos, saveMarketing, savePromo, type PromoCode } from "@/lib/marketing.functions";
import { discountLabel, type Marketing } from "@/lib/promo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const blank = { code: "", kind: "percent" as "percent" | "fixed", value: 10, min_order: 0, starts: "", ends: "", active: true };
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function MarketingPanel({ restaurantId, marketing, onSaved }: { restaurantId: string; marketing?: Marketing | undefined; onSaved?: () => void }) {
  const save = useServerFn(saveMarketing);
  const [m, setM] = useState({
    announcement: { enabled: false, text: "", ...(marketing?.announcement ?? {}) },
    firstOrder: { enabled: false, kind: "percent" as "percent" | "fixed", value: 10, minOrder: 0, ...(marketing?.firstOrder ?? {}) },
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (marketing) setM((x) => ({ announcement: { ...x.announcement, ...marketing.announcement }, firstOrder: { ...x.firstOrder, ...marketing.firstOrder } })); }, [marketing]);

  const list = useServerFn(listPromos);
  const savePc = useServerFn(savePromo);
  const del = useServerFn(deletePromo);
  const { data: promos, refetch } = useQuery({ queryKey: ["promos", restaurantId], queryFn: () => list({ data: { restaurantId } }) });
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState<string | undefined>();

  const saveSettings = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId, marketing: m } }); toast.success("Marketing enregistré"); onSaved?.(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  };
  const submitPromo = async () => {
    try {
      await savePc({ data: { restaurantId, id: editId, code: f.code, kind: f.kind, value: Number(f.value), min_order: Number(f.min_order),
        starts_at: f.starts ? new Date(`${f.starts}T00:00:00`).toISOString() : null, ends_at: f.ends ? new Date(`${f.ends}T23:59:59`).toISOString() : null, active: f.active } });
      toast.success(editId ? "Code modifié" : "Code créé"); setF(blank); setEditId(undefined); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };
  const edit = (p: PromoCode) => { setEditId(p.id); setF({ code: p.code, kind: p.kind, value: Number(p.value), min_order: Number(p.min_order), starts: toLocal(p.starts_at), ends: toLocal(p.ends_at), active: p.active }); };
  const toggle = async (p: PromoCode) => {
    await savePc({ data: { restaurantId, id: p.id, code: p.code, kind: p.kind, value: Number(p.value), min_order: Number(p.min_order), starts_at: p.starts_at ? new Date(p.starts_at).toISOString() : null, ends_at: p.ends_at ? new Date(p.ends_at).toISOString() : null, active: !p.active } });
    refetch();
  };
  const now = Date.now();
  const state = (p: PromoCode) => !p.active ? "Inactif" : p.ends_at && new Date(p.ends_at).getTime() < now ? "Expiré" : p.starts_at && new Date(p.starts_at).getTime() > now ? "À venir" : "Actif";

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <h2 className="text-3xl">Marketing & Promotions</h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> Bannière d'annonce</Label>
          <Switch checked={m.announcement.enabled} onCheckedChange={(v) => setM({ ...m, announcement: { ...m.announcement, enabled: v } })} /></div>
        <Input maxLength={160} placeholder="-10% sur votre première commande avec le code BIENVENUE" value={m.announcement.text} onChange={(e) => setM({ ...m, announcement: { ...m.announcement, text: e.target.value } })} />
        <p className="text-xs text-muted-foreground">Affichée en haut du site et sur l'accueil de la borne.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" /> Offre de premier achat (site web)</Label>
          <Switch checked={m.firstOrder.enabled} onCheckedChange={(v) => setM({ ...m, firstOrder: { ...m.firstOrder, enabled: v } })} /></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={m.firstOrder.kind} onChange={(e) => setM({ ...m, firstOrder: { ...m.firstOrder, kind: e.target.value as "percent" | "fixed" } })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="percent">Pourcentage (%)</option><option value="fixed">Montant fixe (€)</option></select>
          <div><Input type="number" min={0} step="0.5" value={m.firstOrder.value} onChange={(e) => setM({ ...m, firstOrder: { ...m.firstOrder, value: Number(e.target.value) } })} aria-label="Valeur" /></div>
          <div><Input type="number" min={0} value={m.firstOrder.minOrder} onChange={(e) => setM({ ...m, firstOrder: { ...m.firstOrder, minOrder: Number(e.target.value) } })} aria-label="Minimum de commande (€)" placeholder="Minimum €" /></div>
        </div>
        <p className="text-xs text-muted-foreground">Appliquée automatiquement si l'email et le téléphone n'ont jamais commandé dans ce restaurant. Non cumulable avec un code promo.</p>
      </div>
      <Button onClick={saveSettings} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer bannière et offre"}</Button>

      <div className="space-y-3 border-t border-border pt-4">
        <Label className="flex items-center gap-2 text-base"><Tag className="h-4 w-4 text-primary" /> Codes promo</Label>
        <div className="grid gap-2 sm:grid-cols-6">
          <Input className="sm:col-span-2 uppercase" placeholder="BIENVENUE" maxLength={30} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} aria-label="Code" />
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "percent" | "fixed" })} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="percent">%</option><option value="fixed">€</option></select>
          <Input type="number" min={0} step="0.5" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} aria-label="Valeur" />
          <Input type="number" min={0} value={f.min_order} onChange={(e) => setF({ ...f, min_order: Number(e.target.value) })} aria-label="Minimum de commande" title="Minimum de commande (€)" />
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Actif</label>
          <div className="sm:col-span-2"><Label className="text-xs">Valable du</Label><Input type="date" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">au</Label><Input type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button className="flex-1" onClick={submitPromo} disabled={f.code.trim().length < 3}>{editId ? "Modifier" : "Créer le code"}</Button>
            {editId && <Button variant="ghost" onClick={() => { setEditId(undefined); setF(blank); }}>Annuler</Button>}
          </div>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {!promos?.length && <li className="p-3 text-sm text-muted-foreground">Aucun code promo.</li>}
          {promos?.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-mono font-bold">{p.code}</span>
              <span>{discountLabel(p.kind, Number(p.value))}</span>
              {Number(p.min_order) > 0 && <span className="text-muted-foreground">dès {Number(p.min_order)} €</span>}
              {(p.starts_at || p.ends_at) && <span className="text-muted-foreground">{p.starts_at ? `du ${new Date(p.starts_at).toLocaleDateString("fr-FR")} ` : ""}{p.ends_at ? `au ${new Date(p.ends_at).toLocaleDateString("fr-FR")}` : ""}</span>}
              <span className="text-muted-foreground">{p.uses} utilisation(s)</span>
              <span className={state(p) === "Actif" ? "rounded bg-primary/15 px-2 text-primary" : "rounded bg-muted px-2 text-muted-foreground"}>{state(p)}</span>
              <span className="ml-auto flex items-center gap-1">
                <Switch checked={p.active} onCheckedChange={() => toggle(p)} aria-label="Actif" />
                <Button size="icon" variant="ghost" onClick={() => edit(p)} aria-label="Modifier"><Pencil /></Button>
                <Button size="icon" variant="ghost" onClick={async () => { if (confirm(`Supprimer le code ${p.code} ?`)) { await del({ data: { restaurantId, id: p.id } }); refetch(); } }} aria-label="Supprimer"><Trash2 /></Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
