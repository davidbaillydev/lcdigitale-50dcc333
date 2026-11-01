import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNewerBuild } from "@/lib/app-version";

declare const __APP_BUILD_ID__: string;

const CHECK_MS = 5 * 60 * 1000;


/**
 * Shows "Une mise à jour est disponible" when a new version is deployed.
 * Never reloads by itself: orders in progress (cart, kitchen) are untouched
 * until the user taps the button.
 */
export function UpdateNotice() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/public/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: unknown };
        if (isNewerBuild(__APP_BUILD_ID__, data.build)) setAvailable(true);
      } catch {
        /* offline: try again later */
      }
    };
    const id = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);

  if (!available) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm font-medium">Une mise à jour est disponible</p>
      <Button size="sm" className="min-h-11" onClick={() => window.location.reload()}>
        Recharger
      </Button>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setAvailable(false)}>
        Plus tard
      </Button>
    </div>
  );
}
