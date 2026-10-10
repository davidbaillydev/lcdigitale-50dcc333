import { useEffect, useRef, useState } from "react";

/** Vrai quand la page est affichée dans une iframe (window.top peut lever une erreur cross-origin). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Origine du site parent, déduite du referrer (inconnue sinon → "*"). */
function parentOrigin(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "*";
  } catch {
    return "*";
  }
}

/**
 * Envoie un message au site parent (protocole `lc:*`, v:1).
 * Jamais de donnée personnelle dans les messages (ni nom, ni téléphone, ni email, ni adresse).
 */
export function postToParent(msg: Record<string, unknown>): void {
  if (!isEmbedded()) return;
  try {
    window.parent.postMessage({ v: 1, ...msg }, parentOrigin());
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
    const ref = p.get("ref");
    if (ref && /^[a-z0-9.-]{1,253}$/i.test(ref)) sessionStorage.setItem(`ref-${slug}`, ref.toLowerCase());
    if (sessionStorage.getItem(`embed-${slug}`) === "1" && isEmbedded()) setOn(true);
  }, [slug, enabled]);
  return on;
}

/** Signale au parent que la carte est prête (montage de la page restaurant en mode embed). */
export function useEmbedReady(slug: string, embed: boolean): void {
  const sent = useRef(false);
  useEffect(() => {
    if (!embed || sent.current) return;
    sent.current = true;
    postToParent({ type: "lc:ready", slug });
  }, [embed, slug]);
}

/** Signale la hauteur du contenu au parent (mode inline), limité à 1 envoi / 200 ms. */
export function useEmbedResize(embed: boolean): void {
  useEffect(() => {
    if (!embed || typeof ResizeObserver === "undefined") return;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      last = Date.now();
      postToParent({ type: "lc:resize", height: document.body.scrollHeight });
    };
    const ro = new ResizeObserver(() => {
      const wait = 200 - (Date.now() - last);
      if (wait <= 0) send();
      else {
        clearTimeout(timer);
        timer = setTimeout(send, wait);
      }
    });
    ro.observe(document.body);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [embed]);
}

/** Signale le nombre d'articles du panier au parent (badge du bouton). */
export function useEmbedCartCount(embed: boolean, count: number): void {
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (!embed || prev.current === count) return;
    prev.current = count;
    postToParent({ type: "lc:cart", count });
  }, [embed, count]);
}

/** Site parent (https, même hôte que le `ref` transmis par embed.js) pour le bouton « Retour sur le site ». */
export function embedReturnTo(slug: string): { returnTo: string; ref: string } | null {
  try {
    const ref = sessionStorage.getItem(`ref-${slug}`);
    if (!ref || !document.referrer) return null;
    const u = new URL(document.referrer);
    if (u.protocol !== "https:" || u.hostname.toLowerCase() !== ref) return null;
    const returnTo = u.origin + u.pathname;
    return returnTo.length <= 300 ? { returnTo, ref } : null;
  } catch { return null; }
}

/** Ouvre une page de paiement hors de l'iframe (_top), repli nouvel onglet. Renvoie false si repli. */
export function openTop(url: string): boolean {
  try {
    const w = window.open(url, "_top");
    if (w) return true;
  } catch { /* navigation du parent bloquée */ }
  window.open(url, "_blank", "noopener");
  return false;
}

export const pendingOrderKey = (slug: string) => `lc-pending-order-${slug}`;
