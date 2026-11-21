import { Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { listKioskSetupRestaurants } from "@/lib/kiosk-device.functions";
import { kioskDevicePath, readKioskDevice, saveKioskDevice } from "@/lib/kiosk-device";
import { kioskStatus } from "@/lib/orders.functions";
import { KioskDeviceSetup } from "@/components/KioskDeviceSetup";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useKioskLock } from "@/hooks/use-kiosk-lock";
import lcLogo from "@/assets/lc-digitale-logo.png";

export const Route = createFileRoute("/borne")({
  head: () => ({ meta: [
    { title: "LC Borne — Configuration de la tablette" },
    { name: "description", content: "Configuration sécurisée de la borne de commande LC Digitale par restaurant et appareil." },
    { property: "og:title", content: "LC Borne — Configuration de la tablette" },
    { property: "og:description", content: "Démarrage de la borne de commande tactile LC Digitale." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: KioskHub,
});

const restaurantsQuery = queryOptions({
  queryKey: ["kiosk-device-setup"], staleTime: 30_000,
  queryFn: async () => {
    try { return { restaurants: await listKioskSetupRestaurants(), failed: false }; }
    catch { return { restaurants: [], failed: true }; }
  },
});

function Loading() {
  return <div role="status" className="flex flex-1 items-center justify-center gap-3 p-8"><LoaderCircle className="size-6 animate-spin motion-reduce:animate-none text-primary" />Démarrage de LC Borne…</div>;
}

function KioskHub() {
  const [ready, setReady] = useState(false);
  useWakeLock({ always: true }); useKioskLock();
  useEffect(() => {
    let saved = null;
    try { saved = readKioskDevice(localStorage); } catch { /* Setup displays a storage error on save. */ }
    if (saved) {
      window.location.replace(kioskDevicePath(saved));
    } else setReady(true);
  }, []);
  return <main className="restaurant-directory flex h-dvh flex-col overflow-y-auto bg-background text-foreground">
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><img src={lcLogo} alt="LC Digitale" className="h-10 w-14 object-contain" /><span className="text-xl font-semibold">LC Borne</span></div><ThemeToggle className="size-12" /></header>
    {!ready ? <Loading /> : <Suspense fallback={<Loading />}><Setup /></Suspense>}
  </main>;
}

function Setup() {
  const { data, refetch, isFetching } = useSuspenseQuery(restaurantsQuery);
  const status = useServerFn(kioskStatus);
  if (data.failed) return <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center"><h1 className="text-2xl font-semibold">Connexion aux restaurants indisponible</h1><p className="text-muted-foreground">Vérifiez la connexion Internet de la tablette.</p><Button disabled={isFetching} onClick={() => void refetch()} className="h-12"><RefreshCw />Réessayer</Button></div>;
  return <KioskDeviceSetup restaurants={data.restaurants} onLaunch={async (device) => {
    const current = await status({ data: { restaurant: device.slug, kioskId: device.kioskId } });
    if (current.access !== "ok") throw new Error("Cette borne n’est plus disponible. Sélectionnez une borne active.");
    try { saveKioskDevice(localStorage, device); }
    catch { throw new Error("Mémorisation impossible : autorisez le stockage sur cette tablette."); }
    window.location.replace(kioskDevicePath(device));
  }} />;
}