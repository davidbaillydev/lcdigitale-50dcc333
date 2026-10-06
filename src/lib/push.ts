/** Notifications Web Push (gratuites). Appeler les fonctions navigateur depuis un gestionnaire d'événement. */
export const VAPID_PUBLIC_KEY = "BAUdr8NLjaYE1j1S7su85SorVeF8nfxePAbxe4cj0IFNevQY2y9JfJ7Ez-Yac4fO5CS9GAs3qZCF9WuP1c19GQ4";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone/iPad : le push n'existe que si le site est ajouté à l'écran d'accueil. */
export const needsInstallForPush = () => typeof window !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

const key = () => { const s = atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

/** Demande l'autorisation et renvoie l'adresse d'abonnement de l'appareil, ou null si refusé. */
export async function getPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  if ((await Notification.requestPermission()) !== "granted") return null;
  const reg = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }));
  return sub.endpoint;
}
