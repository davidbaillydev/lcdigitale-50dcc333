import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { retryPosSync } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";

type O = { id: string; pos_status?: string | null; pos_ref?: string | null; pos_synced_at?: string | null; pos_error?: string | null };

/** État de synchronisation caisse d'une commande, avec relance en un clic. */
export function PosSyncStatus({ o, onDone }: { o: O; onDone?: () => void }) {
  const retry = useServerFn(retryPosSync);
  const [busy, setBusy] = useState(false);
  if (o.pos_status === "synced")
    return <p className="text-xs text-muted-foreground">Caisse : synchronisée{o.pos_ref ? ` (réf. ${o.pos_ref})` : ""}{o.pos_synced_at ? ` à ${new Date(o.pos_synced_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>;
  if (o.pos_status !== "error") return null;
  const run = async () => {
    setBusy(true);
    try { await retry({ data: { orderId: o.id } }); toast.success("Commande envoyée à la caisse"); onDone?.(); }
    catch (e) { toast.error((e as Error).message); onDone?.(); } finally { setBusy(false); }
  };
  return (
    <div role="alert" className="rounded bg-destructive/15 p-2 text-sm">
      <p className="font-medium">Échec d'envoi à la caisse</p>
      {o.pos_error && <p className="break-words text-xs text-muted-foreground">{o.pos_error}</p>}
      <Button size="sm" variant="outline" className="mt-2 min-h-11 w-full" disabled={busy} onClick={run}><RefreshCw className={busy ? "animate-spin" : ""} /> Relancer la synchronisation</Button>
    </div>
  );
}
