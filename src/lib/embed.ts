import { useEffect, useState } from "react";

/** Vrai quand la page est affichée dans une iframe (window.top peut lever une erreur cross-origin). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Envoie un message au site parent (bouton intégré, hauteur, fermeture…). */
export function postToParent(msg: unknown): void {
  if (!isEmbedded()) return;
  try {
    window.parent.postMessage(msg, "*");
  } catch {
    /* parent injoignable */
  }
}

/**
 * Mode « intégré » d'un restaurant : activé par ?embed=1 (mémorisé en sessionStorage),
 * actif tant que la page reste dans une iframe. Ignoré si le module embed est désactivé.
 */
export function useEmbedMode(slug: string, enabled = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("embed") === "1") sessionStorage.setItem(`embed-${slug}`, "1");
    if (p.get("src") === "embed") sessionStorage.setItem(`src-${slug}`, "embed");
    if (sessionStorage.getItem(`embed-${slug}`) === "1" && isEmbedded()) setOn(true);
  }, [slug, enabled]);
  return on;
}
