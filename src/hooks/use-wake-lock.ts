import { useCallback, useEffect, useRef, useState } from "react";

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: "release", cb: () => void) => void };
type WakeNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };

/** Empêche la mise en veille de l'écran pendant le service (Screen Wake Lock API). */
export function useWakeLock() {
  const [wanted, setWanted] = useState(false);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef<Sentinel | null>(null);

  const acquire = useCallback(async () => {
    const nav = navigator as WakeNav;
    if (!nav.wakeLock) { setSupported(false); return false; }
    try {
      const s = await nav.wakeLock.request("screen");
      ref.current = s; setActive(true);
      s.addEventListener("release", () => setActive(false));
      return true;
    } catch { setActive(false); return false; }
  }, []);

  useEffect(() => {
    setWanted(localStorage.getItem("kds-wake") === "1");
    setSupported(Boolean((navigator as WakeNav).wakeLock));
  }, []);

  useEffect(() => {
    if (!wanted) { void ref.current?.release(); ref.current = null; setActive(false); return; }
    void acquire();
    // Le navigateur libère le verrou quand l'onglet est masqué : on le reprend au retour.
    const onVis = () => { if (document.visibilityState === "visible" && (!ref.current || ref.current.released)) void acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wanted, acquire]);

  const toggle = useCallback(() => setWanted((w) => { localStorage.setItem("kds-wake", w ? "0" : "1"); return !w; }), []);
  return { wanted, active, supported, toggle };
}
