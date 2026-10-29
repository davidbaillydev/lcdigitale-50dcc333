import { useCallback, useEffect, useRef, useState } from "react";

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: "release", cb: () => void) => void };
type WakeNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };

/**
 * Empêche la mise en veille de l'écran pendant le service (Screen Wake Lock API).
 * `always` : toujours demandé (borne), sinon interrupteur mémorisé sur l'appareil (cuisine).
 * Le verrou est repris automatiquement : retour d'onglet, libération par le système,
 * premier appui (exigé par certains navigateurs) et contrôle toutes les 30 s.
 */
export function useWakeLock(opts: { always?: boolean } = {}) {
  const always = !!opts.always;
  const [wanted, setWanted] = useState(always);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef<Sentinel | null>(null);
  const busy = useRef(false);

  const acquire = useCallback(async () => {
    const nav = navigator as WakeNav;
    if (!nav.wakeLock) { setSupported(false); return false; }
    if (busy.current || (ref.current && !ref.current.released) || document.visibilityState !== "visible") return !!ref.current;
    busy.current = true;
    try {
      const s = await nav.wakeLock.request("screen");
      ref.current = s; setActive(true);
      s.addEventListener("release", () => { setActive(false); ref.current = null; });
      return true;
    } catch { setActive(false); return false; } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    if (!always) setWanted(localStorage.getItem("kds-wake") === "1");
    setSupported(Boolean((navigator as WakeNav).wakeLock));
  }, [always]);

  useEffect(() => {
    if (!wanted) { void ref.current?.release(); ref.current = null; setActive(false); return; }
    void acquire();
    const retry = () => { if (!ref.current || ref.current.released) void acquire(); };
    const onVis = () => { if (document.visibilityState === "visible") retry(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", retry);
    window.addEventListener("focus", retry);
    const t = setInterval(retry, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("focus", retry);
      clearInterval(t);
    };
  }, [wanted, acquire]);

  useEffect(() => () => { void ref.current?.release(); }, []);

  const toggle = useCallback(() => setWanted((w) => { localStorage.setItem("kds-wake", w ? "0" : "1"); return !w; }), []);
  return { wanted, active, supported, toggle };
}
