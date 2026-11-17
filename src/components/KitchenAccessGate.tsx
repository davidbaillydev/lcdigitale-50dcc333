import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { hasKitchenPin } from "@/lib/kitchen-pin.functions";
import { KitchenLock } from "@/components/KitchenLock";
import { Button } from "@/components/ui/button";

/** Locked screens must not mount order queries, Realtime or offline snapshots. */
export function KitchenAccessGate({ restaurantId, name, children }: { restaurantId: string; name: string; children: (lock: () => void, pinEnabled: boolean) => ReactNode }) {
  const checkPin = useServerFn(hasKitchenPin);
  const [status, setStatus] = useState<"checking" | "error" | "locked" | "open">("checking");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("checking");
    checkPin({ data: { restaurantId } }).then(({ enabled }) => {
      if (!active) return;
      setPinEnabled(enabled);
      setStatus(enabled ? "locked" : "open");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [restaurantId, checkPin, retry]);
  useEffect(() => {
    if (!pinEnabled || status !== "open") return;
    let timer = setTimeout(() => setStatus("locked"), 5 * 60_000);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => setStatus("locked"), 5 * 60_000); };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, [pinEnabled, status]);
  if (status === "checking") return <p role="status" className="p-6 text-muted-foreground">Vérification de l'accès cuisine…</p>;
  if (status === "error") return <div className="p-6"><p role="alert">Impossible de vérifier l'accès cuisine.</p><Button onClick={() => setRetry((n) => n + 1)}>Réessayer</Button></div>;
  if (status === "locked") return <KitchenLock restaurantId={restaurantId} name={name} onUnlock={() => setStatus("open")} />;
  return children(() => { if (pinEnabled) setStatus("locked"); }, pinEnabled);
}