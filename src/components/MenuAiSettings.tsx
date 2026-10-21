import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMenuAiSettings, saveMenuAiKey, removeMenuAiKey } from "@/lib/menu-ai-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function MenuAiSettings() {
  const get = useServerFn(getMenuAiSettings);
  const save = useServerFn(saveMenuAiKey);
  const remove = useServerFn(removeMenuAiKey);
  const client = useQueryClient();
  const queryKey = ["agency-menu-ai"];
  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => get() });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const update = async (deleting: boolean) => {
    setBusy(true);
    try {
      const result = deleting ? await remove() : await save({ data: { apiKey: key } });
      client.setQueryData(queryKey, result);
      setKey(""); setConfirm(false);
      toast.success(deleting ? "Clé Gemini supprimée" : "Clé Gemini enregistrée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  };
  return <section className="mt-8 space-y-5 border-t border-border pt-6">
    <div className="flex items-center gap-3"><KeyRound className="h-6 w-6 text-primary" /><h2 className="font-display text-2xl font-semibold">Gemini · Analyse des cartes</h2></div>
    <p className="text-sm text-muted-foreground">{isPending ? "Chargement…" : error ? "Réglage indisponible" : data?.configured ? "Clé enregistrée · Gemini actif pour les imports de tous les restaurants" : "Aucune clé Gemini · Analyse Lovable AI active"}</p>
    <form onSubmit={(e) => { e.preventDefault(); void update(false); }} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="gemini-key">{data?.configured ? "Remplacer la clé API Gemini" : "Clé API Gemini"}</Label>
        <Input id="gemini-key" type="password" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Saisir une clé Google AI Studio" disabled={busy || isPending || Boolean(error)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">Obtenir une clé dans Google AI Studio</a>
        <div className="flex flex-wrap gap-2">
          {data?.configured && <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm(true)}><Trash2 /> Supprimer la clé</Button>}
          <Button type="submit" disabled={busy || !key.trim() || isPending || Boolean(error)}><Save /> {busy ? "Enregistrement…" : "Enregistrer la clé"}</Button>
        </div>
      </div>
    </form>
    <p className="text-xs text-muted-foreground">Les documents sont transmis à Google pour analyse. L’utilisation est soumise aux quotas et à la facturation de votre compte Google. La carte reste à valider avant publication.</p>
    <AlertDialog open={confirm} onOpenChange={(open) => { if (!busy) setConfirm(open); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer la clé Gemini ?</AlertDialogTitle><AlertDialogDescription>Les prochains imports utiliseront Lovable AI et les crédits de l’agence. Les cartes existantes restent inchangées.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void update(true); }}>Supprimer la clé</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}