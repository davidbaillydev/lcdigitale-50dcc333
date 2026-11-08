import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAgencyRestaurant } from "@/lib/restaurant-deletion.functions";
import { exactRestaurantConfirmation } from "@/lib/restaurant-deletion";

export function DeleteRestaurantDialog({ restaurant, onClose, onDeleted }: {
  restaurant: { id: string; name: string; slug: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useServerFn(deleteAgencyRestaurant);
  const cache = useQueryClient();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (busy || !exactRestaurantConfirmation(restaurant.name, confirmation)) return;
    setBusy(true); setError(null);
    try {
      await remove({ data: { id: restaurant.id, confirmation } });
      await cache.invalidateQueries();
      await router.invalidate();
      toast.success("Restaurant supprimé définitivement");
      onDeleted();
    } catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible"); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }} onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle className="pr-8 text-2xl">Supprimer le restaurant</DialogTitle>
        <DialogDescription className="break-words">{restaurant.name} · /{restaurant.slug}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 border-l-4 border-destructive bg-destructive/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-5 shrink-0" />Action définitive et irréversible</p>
        <p>Le restaurant, sa configuration, ses accès d’équipe et ses commandes et tickets de test associés seront supprimés. Aucun retour en arrière n’est possible.</p>
        <p>Les comptes personnels ne sont pas supprimés. Un historique commercial ou fiscal réel bloque cette action : désactivez plutôt le restaurant.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-restaurant-confirmation">Saisissez le nom exact du restaurant</Label>
        <p className="break-words font-semibold">{restaurant.name}</p>
        <Input id="delete-restaurant-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} autoComplete="off" />
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button variant="destructive" onClick={submit} disabled={busy || !exactRestaurantConfirmation(restaurant.name, confirmation)} className="min-h-12"><Trash2 />{busy ? "Suppression…" : "Supprimer définitivement"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}