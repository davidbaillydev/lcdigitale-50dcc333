import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMenuTemplates, publishMenuTemplate } from "@/lib/menu-templates.functions";

export function MenuTemplatePanel({ restaurantId, name, onSaved }: { restaurantId: string; name: string; onSaved?: () => void }) {
  const list = useServerFn(listMenuTemplates);
  const publish = useServerFn(publishMenuTemplate);
  const [label, setLabel] = useState(name);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let alive = true; list({ data: { restaurantId } }).then((rows) => { if (!alive) return; const row = rows.find((t) => t.restaurant_id === restaurantId); setExists(Boolean(row)); setLabel(row?.name ?? name); setLoaded(true); }).catch((e) => toast.error(e.message)); return () => { alive = false; }; }, [restaurantId]);
  const save = async (remove = false) => {
    if (remove && !confirm("Retirer ce restaurant des modèles ? Les cartes déjà configurées ne seront pas modifiées.")) return;
    setBusy(true);
    try { await publish({ data: { restaurantId, name: label, remove } }); setExists(!remove); onSaved?.(); toast.success(remove ? "Modèle retiré" : "Structure enregistrée comme modèle"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-y border-border py-5">
    <h2 className="flex items-center gap-2 text-2xl"><Layers className="h-5 w-5" /> Modèle de structure de carte</h2>
    <p className="text-sm text-muted-foreground">{exists ? "Restaurant modèle · structure indépendante des cartes qui l’utilisent." : "Ce restaurant n’est pas encore un modèle."}</p>
    <label className="block space-y-2 text-sm font-semibold">Nom du modèle<Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} /></label>
    <p className="text-sm text-muted-foreground">La carte enregistrée fournit les catégories, formats et choix. Les photos, descriptions et informations clients ne sont pas copiées.</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !loaded || !label.trim()} onClick={() => void save()}><Save />{exists ? "Actualiser le modèle depuis la carte" : "Définir comme modèle"}</Button>
      {exists && <Button variant="outline" disabled={busy} onClick={() => void save(true)}><Trash2 />Retirer le modèle</Button>}</div>
  </section>;
}