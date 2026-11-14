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
import { isNewOrderAlert, type AlertOrder } from "@/lib/order-alert";
import { consumeAvailabilityNotifications } from "@/lib/availability-notifications.functions";

export function ProfessionalAlerts() {
  const { restaurants, user } = useStaff();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const latest = useRef({ restaurants, path }); latest.current = { restaurants, path };
  const audio = useRef<AudioContext | null>(null);
  const device = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerStaffPush);
  const remove = useServerFn(removeStaffPush);
  const consumeResumes = useServerFn(consumeAvailabilityNotifications);
  const resumeIds = restaurants.filter((r) => r.role === "manager" || r.role === "agency").map((r) => r.id).join(",");
  useEffect(() => {
    if (!user || !resumeIds) return;
    let running = false;
    let disposed = false;
    const read = async () => {
      if (running || disposed || document.visibilityState === "hidden") return;
      running = true;
      try {
        const notifications = await consumeResumes();
        for (const notification of notifications) {
          toast.success(`${notification.restaurant_name} · Les commandes ont repris automatiquement`, {
            id: notification.id,
            duration: 12000,
            description: new Date(notification.occurred_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) + " (Paris)",
            action: { label: "Ouvrir la cuisine", onClick: () => { window.location.assign(`/espace/${notification.restaurant_slug}`); } },
          });
        }
      } catch { /* Pending notifications remain available after a failed read. */ }
      finally { running = false; }
    };
    const channel = supabase.channel(`availability-notifications-${user.id}`);
    for (const id of resumeIds.split(",")) {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${id}` }, () => void read());
    }
    channel.subscribe((status) => { if (status === "SUBSCRIBED") void read(); });
    void read();
    window.addEventListener("focus", read);
    window.addEventListener("online", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      disposed = true;
      window.removeEventListener("focus", read);
      window.removeEventListener("online", read);
      document.removeEventListener("visibilitychange", read);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, resumeIds, consumeResumes]);
  useEffect(() => {
    const start = () => { audio.current ??= new AudioContext(); void audio.current.resume().then(() => setSoundOn(true)).catch(() => {}); };
    window.addEventListener("lc-professional-sound-start", start);
    return () => window.removeEventListener("lc-professional-sound-start", start);
  }, []);
  const enable = async () => {
    setBusy(true);
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      const current = restaurants.find((r) => path.split("/")[2] === r.slug) ?? restaurants[0];
      playOrderSound(audio.current, orderSoundOf(current?.config));
      setSoundOn(true);
      if (!pushSupported() || needsInstallForPush()) { toast.info("Son activé ici. Pour les notifications sur iPhone/iPad, ajoutez l'application à l'écran d'accueil."); return; }
      if (window.top !== window.self) { toast.info("Son activé ici. Ouvrez l'application dans son propre onglet pour autoriser les notifications."); return; }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { toast.info("Son activé ici ; notifications refusées dans les réglages du navigateur."); return; }
      const worker = await navigator.serviceWorker.register("/staff-push-sw.js", { scope: "/espace/" });
      if (!worker.active) await new Promise<void>((resolve, reject) => {
        const candidate = worker.installing ?? worker.waiting;
        if (!candidate) return resolve();
        if (candidate.state === "activated") return resolve();
        const timer = setTimeout(() => reject(new Error("Activation indisponible")), 12000);
        candidate.addEventListener("statechange", () => { if (candidate.state === "activated") { clearTimeout(timer); resolve(); } });
      });
      const publicKey = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const subscribe = async () => await worker.pushManager.getSubscription() ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const subscription = await Promise.race([subscribe(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Service de notifications indisponible")), 12000); })]).finally(() => { clearTimeout(timeout); });
      const result = await register({ data: { endpoint: subscription.endpoint, restaurantIds: restaurants.map((r) => r.id) } });
      if (!user) return;
      await storeStaffAlertDevice({ ...result, userId: user.id }); device.current = result.id;
      localStorage.setItem("lc-staff-push-id", result.id);
      localStorage.setItem("lc-staff-push-user", user.id); setActive(true);
      toast.success("Son et notifications en arrière-plan activés sur cet appareil");
    } catch { toast.error("Son activé ici ; notifications indisponibles. Réessayez depuis l'application publiée et vérifiez les autorisations de votre appareil."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    try {
      const id = device.current ?? localStorage.getItem("lc-staff-push-id");
      if (id) await remove({ data: { id } });
      await storeStaffAlertDevice(null);
      localStorage.removeItem("lc-staff-push-id"); localStorage.removeItem("lc-staff-push-user"); device.current = null; setActive(false); setSoundOn(false);
    } catch { toast.error("Impossible de désactiver les notifications : réessayez."); }
  };
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setActive(false); setSoundOn(false); void storeStaffAlertDevice(null).catch(() => {}); }
    });
    return () => { data.subscription.unsubscribe(); void audio.current?.close().catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!user) return;
    const id = localStorage.getItem("lc-staff-push-id");
    if (id && localStorage.getItem("lc-staff-push-user") === user.id) { device.current = id; setActive(true); }
    else void storeStaffAlertDevice(null).catch(() => {});
  }, [user?.id]);
  const ids = restaurants.map((r) => r.id).join(",");
  useEffect(() => {
    if (!soundOn || !ids) return;
    const seen = new Set<string>();
    const statuses = new Map<string, string>();
    void supabase.from("orders").select("id, status").in("restaurant_id", ids.split(",")).gte("created_at", new Date(Date.now() - 86400_000).toISOString()).then(({ data }) => {
      for (const order of data ?? []) { if (!statuses.has(order.id)) statuses.set(order.id, order.status); }
    });
    const channel = supabase.channel(`professional-alerts-${user?.id}`);
    for (const id of ids.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${id}` }, (event) => {
        const order = event.new as AlertOrder & { restaurant_id?: string };
        const old = event.old as { status?: string };
        if (!order.id) return;
        const previous = old.status ?? statuses.get(order.id);
        statuses.set(order.id, order.status);
        if (!isNewOrderAlert(event.eventType, order, previous)) return;
        if (seen.has(order.id)) return; seen.add(order.id);
        const r = latest.current.restaurants.find((item) => item.id === order.restaurant_id);
        if (!r) return;
        // The kitchen owns its repeated alarm; elsewhere (including POS), this player remains mounted.
        if (latest.current.path.replace(/\/$/, "") === `/espace/${r.slug}`) return;
        const ctx = audio.current;
        if (ctx) void Promise.resolve(supabase.from("restaurants").select("config").eq("id", r.id).maybeSingle()).then(async ({ data }) => {
          await ctx.resume(); playOrderSound(ctx, orderSoundOf((data?.config ?? r.config) as { orderSound?: unknown }));
        }).catch(() => {});
        toast.info(`${r.name} · Nouvelle commande à traiter`);
      });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [soundOn, ids, user?.id]);
  return <Button variant={active ? "secondary" : "outline"} size="icon" className="size-11 shrink-0" aria-label={active ? "Désactiver les alertes commandes" : "Activer le son et les notifications commandes"} title={active ? "Désactiver les alertes commandes" : "Activer le son et les notifications commandes"} disabled={busy || !restaurants.length} onClick={() => void (active ? disable() : enable())}>{active ? <Bell /> : <BellOff />}</Button>;
}