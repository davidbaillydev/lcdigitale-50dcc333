import { useCallback, useEffect, useRef } from "react";
import type React from "react";

/**
 * Appui long (défaut 1,5 s) : ouvre un réglage discret sans gêner l'usage normal de l'écran.
 * Annulé si le doigt bouge, quitte la zone, ou si le composant est démonté.
 * Les props retournées se collent directement sur l'élément sensible.
 */
export function useLongPress(onLongPress: () => void, ms = 1500) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const clear = useCallback(() => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    origin.current = null;
  }, []);
  const start = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    clear();
    origin.current = { x: e.clientX, y: e.clientY };
    // Keep the gesture on its trigger rather than letting an image drag or a
    // nested welcome-screen handler take it over in Android WebView.
    e.stopPropagation();
    if (e.target === e.currentTarget && e.currentTarget instanceof HTMLElement && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    timer.current = window.setTimeout(() => { timer.current = null; origin.current = null; onLongPress(); }, ms);
  }, [ms, onLongPress, clear]);
  const move = useCallback((e: React.PointerEvent) => {
    const o = origin.current;
    if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 12) clear();
  }, [clear]);
  useEffect(() => clear, [clear]);
  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onLostPointerCapture: clear,
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
