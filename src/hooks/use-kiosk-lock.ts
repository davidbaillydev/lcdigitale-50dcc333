import { useEffect } from "react";

/**
 * Verrouillage « mode kiosque » pour tablettes cuisine et bornes : bloque le pinch-zoom,
 * le double-tap zoom, le zoom Ctrl+molette et le pull-to-refresh tant que l'écran est monté.
 */
export function useKioskLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    html.classList.add("kiosk-lock");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");

    const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
    const pinch = (e: TouchEvent) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); };
    let lastTap = 0;
    const doubleTap = (e: TouchEvent) => {
      const now = Date.now();
      const t = e.target as HTMLElement | null;
      const editable = t?.closest("input, textarea, select, [contenteditable=true]");
      if (!editable && now - lastTap < 300 && e.cancelable) e.preventDefault();
      lastTap = now;
    };
    const wheel = (e: WheelEvent) => { if (e.ctrlKey && e.cancelable) e.preventDefault(); };
    const keys = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault(); };

    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", stop, opts);
    document.addEventListener("gesturechange", stop, opts);
    document.addEventListener("touchmove", pinch, opts);
    document.addEventListener("touchend", doubleTap, opts);
    document.addEventListener("wheel", wheel, opts);
    document.addEventListener("keydown", keys);
    return () => {
      html.classList.remove("kiosk-lock");
      if (meta && previous !== null) meta.setAttribute("content", previous);
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", pinch);
      document.removeEventListener("touchend", doubleTap);
      document.removeEventListener("wheel", wheel);
      document.removeEventListener("keydown", keys);
    };
  }, [enabled]);
}
