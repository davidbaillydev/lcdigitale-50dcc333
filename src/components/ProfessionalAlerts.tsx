import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useStaff } from "@/hooks/use-staff";
import { supabase } from "@/integrations/supabase/client";
import { orderSoundOf, playOrderSound } from "@/lib/order-sound";
import { pushSupported, needsInstallForPush, VAPID_PUBLIC_KEY } from "@/lib/push";
import { registerStaffPush, removeStaffPush } from "@/lib/staff-push.functions";
import { storeStaffAlertDevice } from "@/lib/staff-alert-device";

export function ProfessionalAlerts() {
  const { restaurants, user } = useStaff();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const latest = useRef({ restaurants, path }); latest.current = { restaurants, path };
  const audio = useRef<AudioContext | null>(null);
  const device = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerStaffPush);
  const remove = useServerFn(removeStaffPush);
  const enable = async () => {
    setBusy(true);
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      const current = restaurants.find((r) => path.split("/")[2] === r.slug) ?? restaurants[0];
      playOrderSound(audio.current, orderSoundOf(current?.config));
      setActive(true);
      if (!pushSupported() || needsInstallForPush()) { toast.info("Son activé ici. Pour les notifications sur iPhone/iPad, ajoutez l'application à l'écran d'accueil."); return; }
      if (window.top !== window.self) { toast.info("Son activé ici. Ouvrez l'application dans son propre onglet pour autoriser les notifications."); return; }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { toast.info("Son activé ici ; notifications refusées dans les réglages du navigateur."); return; }
      const worker = await navigator.serviceWorker.register("/staff-push-sw.js", { scope: "/espace/" });
      if (!worker.active) await new Promise<void>((resolve) => {
        const candidate = worker.installing ?? worker.waiting;
        if (!candidate) return resolve();
        candidate.addEventListener("statechange", () => { if (candidate.state === "activated") resolve(); });
      });
      const publicKey = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const subscription = await worker.pushManager.getSubscription() ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      const result = await register({ data: { endpoint: subscription.endpoint, restaurantIds: restaurants.map((r) => r.id) } });
      if (!user) return;
      await storeStaffAlertDevice({ ...result, userId: user.id }); device.current = result.id;
      localStorage.setItem("lc-staff-push-id", result.id);
      toast.success("Son et notifications en arrière-plan activés sur cet appareil");
    } catch { toast.error("Les notifications n'ont pas pu être activées ; vérifiez les autorisations de votre appareil."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    try {
      const id = device.current ?? localStorage.getItem("lc-staff-push-id");
      if (id) await remove({ data: { id } });
      await storeStaffAlertDevice(null);
      localStorage.removeItem("lc-staff-push-id"); device.current = null; setActive(false);
    } catch { toast.error("Impossible de désactiver les notifications : réessayez."); }
  };
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setActive(false); void storeStaffAlertDevice(null).catch(() => {}); }
    });
    return () => { data.subscription.unsubscribe(); void audio.current?.close().catch(() => {}); };
  }, []);
  const ids = restaurants.map((r) => r.id).join(",");
  useEffect(() => {
    if (!active || !ids) return;
    const seen = new Set<string>();
    const channel = supabase.channel(`professional-alerts-${user?.id}`);
    for (const id of ids.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${id}` }, (event) => {
        const order = event.new as { id?: string; restaurant_id?: string; status?: string; is_test?: boolean; source?: string };
        const old = event.old as { status?: string };
        if (!order.id || order.is_test || order.source === "pos" || !["new", "accepted", "pending_approval"].includes(order.status ?? "")) return;
        if (event.eventType !== "INSERT" && old.status !== "awaiting_payment") return;
        if (seen.has(order.id)) return; seen.add(order.id);
        const r = latest.current.restaurants.find((item) => item.id === order.restaurant_id);
        if (!r) return;
        // The kitchen owns its repeated alarm; elsewhere (including POS), this player remains mounted.
        if (latest.current.path.replace(/\/$/, "") === `/espace/${r.slug}`) return;
        const ctx = audio.current;
        if (ctx) void ctx.resume().then(() => playOrderSound(ctx, orderSoundOf(r.config))).catch(() => {});
        toast.info(`${r.name} · Nouvelle commande à traiter`);
      });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [active, ids, user?.id]);
  return <Button variant={active ? "secondary" : "outline"} size="icon" className="size-11 shrink-0" aria-label={active ? "Désactiver les alertes commandes" : "Activer le son et les notifications commandes"} title={active ? "Désactiver les alertes commandes" : "Activer le son et les notifications commandes"} disabled={busy || !restaurants.length} onClick={() => void (active ? disable() : enable())}>{active ? <Bell /> : <BellOff />}</Button>;
}