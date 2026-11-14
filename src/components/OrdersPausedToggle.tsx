import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getOrdersAvailabilityHistory, toggleOrdersPaused } from "@/lib/restaurant-settings.functions";
import { useLiveRestaurant } from "@/hooks/use-orders-paused";
import { History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";

/** Interrupteur 1-clic de la prise de commandes, enregistré immédiatement et synchronisé en direct. */
export function OrdersPausedToggle({ restaurant, className = "" }: { restaurant: Pick<Restaurant, "id" | "config"> & { opening?: Restaurant["opening"] }; className?: string }) {
  const live = useLiveRestaurant(restaurant);
  const paused = live.config.ordersPaused === true;
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getOrdersAvailabilityHistory>>>([]);
  const [more, setMore] = useState(false);
  const loadHistory = useServerFn(getOrdersAvailabilityHistory);
  const readHistory = async (before?: string) => {
    setHistoryBusy(true); setHistoryError("");
    try {
      const result = await loadHistory({ data: { restaurantId: restaurant.id, before } });
      setRows((prev) => before ? [...prev, ...result] : result); setMore(result.length === 50);
    } catch (e) { setHistoryError((e as Error).message); }
    finally { setHistoryBusy(false); }
  };
  const dateLabel = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "medium" });
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = useServerFn(toggleOrdersPaused);
  const cur = optimistic ?? paused;
  const flip = async () => {
    const next = !cur;
    if (next && !window.confirm("Suspendre la prise de commandes ? Les clients ne pourront plus commander (site, borne, QR, téléphone). Réactivation automatique au prochain service, ou le lendemain à minuit si aucun horaire n’est renseigné (heure de Paris).")) return;
    setBusy(true); setOptimistic(next);
    try { const result = await toggle({ data: { restaurantId: restaurant.id, paused: next } }); setResumeAt(result.resumeAt); toast.success(next ? "Prise de commandes suspendue" : "Prise de commandes active"); }
    catch (e) { setOptimistic(null); toast.error((e as Error).message); }
    finally { setBusy(false); setTimeout(() => setOptimistic(null), 3000); }
  };
  return (
    <div className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 items-center gap-2">
    <Button type="button" size="lg" variant={cur ? "destructive" : "secondary"} disabled={busy} onClick={flip} aria-pressed={!cur}
      title={cur ? "Réactiver la prise de commandes" : "Suspendre la prise de commandes"} className={"min-h-12 min-w-0 whitespace-normal text-base font-semibold " + className}>
      {cur ? "🔴 Prise de commandes suspendue" : "🟢 Prise de commandes active"}
    </Button>
    <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" title="Historique des suspensions" aria-label="Historique des suspensions" onClick={() => { setHistoryOpen(true); void readHistory(); }}><History className="h-5 w-5" /></Button>
    </div>
    {cur && (resumeAt ?? live.config.ordersResumeAt) && <p className="text-sm text-muted-foreground">Reprise automatique : {dateLabel(resumeAt ?? live.config.ordersResumeAt ?? "")} (Paris)</p>}
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Historique des commandes en ligne</DialogTitle><DialogDescription>Suspensions et réactivations · heure de Paris</DialogDescription></DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto" aria-busy={historyBusy}>
        {historyError && <p role="alert" className="text-destructive">{historyError}</p>}
        {!rows.length && <p className="py-4 text-muted-foreground">{historyBusy ? "Chargement…" : "Aucune suspension ni réactivation enregistrée."}</p>}
        <ul className="divide-y divide-border">{rows.map((row) => <li key={row.id} className="space-y-1 py-3"><p className="font-semibold">{row.action === "suspended" ? "Commandes suspendues" : row.action === "auto_resumed" ? "Réactivation automatique" : "Commandes réactivées"}</p><p className="break-all text-sm">{row.action === "auto_resumed" ? "Système · automatique" : row.actor_email ?? "Intervention système"}</p><p className="text-sm text-muted-foreground">{dateLabel(row.occurred_at)}</p>{row.resume_at && <p className="text-sm text-muted-foreground">Reprise prévue : {dateLabel(row.resume_at)}</p>}</li>)}</ul>
      </div>
      {historyError && <Button variant="outline" onClick={() => void readHistory()}>Réessayer</Button>}
      {more && <Button variant="outline" disabled={historyBusy} onClick={() => void readHistory(rows.at(-1)?.occurred_at)}>Voir plus</Button>}
    </DialogContent></Dialog>
    </div>
  );
}
