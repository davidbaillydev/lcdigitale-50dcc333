import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toggleOrdersPaused } from "@/lib/restaurant-settings.functions";
import { useOrdersPaused } from "@/hooks/use-orders-paused";
import type { Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";

/** Interrupteur 1-clic de la prise de commandes, enregistré immédiatement et synchronisé en direct. */
export function OrdersPausedToggle({ restaurant, className = "" }: { restaurant: Pick<Restaurant, "id" | "config" | "opening">; className?: string }) {
  const paused = useOrdersPaused(restaurant);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = useServerFn(toggleOrdersPaused);
  const cur = optimistic ?? paused;
  const flip = async () => {
    const next = !cur;
    if (next && !window.confirm("Suspendre la prise de commandes ? Les clients ne pourront plus commander (site, borne, QR, téléphone).")) return;
    setBusy(true); setOptimistic(next);
    try { await toggle({ data: { restaurantId: restaurant.id, paused: next } }); toast.success(next ? "Prise de commandes suspendue" : "Prise de commandes active"); }
    catch (e) { setOptimistic(null); toast.error((e as Error).message); }
    finally { setBusy(false); setTimeout(() => setOptimistic(null), 3000); }
  };
  return (
    <Button type="button" size="lg" variant={cur ? "destructive" : "secondary"} disabled={busy} onClick={flip} aria-pressed={!cur}
      title={cur ? "Réactiver la prise de commandes" : "Suspendre la prise de commandes"} className={"min-h-12 text-base font-semibold " + className}>
      {cur ? "🔴 Prise de commandes suspendue" : "🟢 Prise de commandes active"}
    </Button>
  );
}
