import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { safeSession } from "./safe-storage";
import { trackCartSession, STEPS, type CartStep } from "./analytics.functions";
import { unitPrice } from "./menu";
import type { Catalog } from "./catalogs";
import type { CartLine } from "./cart";

type Opts = { restaurantId: string; slug: string; lines: CartLine[]; catalog: Catalog; total: number; qrActive: boolean };

function newId() {
  try { return crypto.randomUUID(); } catch { return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16)); }
}

function channel(qrActive: boolean): "web" | "borne" | "qr_code" {
  if (window.location.pathname.includes("/borne")) return "borne";
  const p = new URLSearchParams(window.location.search);
  return qrActive || p.has("table") || p.has("room") || p.has("qr") ? "qr_code" : "web";
}

function provenance(): string {
  if (window.location.pathname.includes("/borne")) return "Borne";
  const p = new URLSearchParams(window.location.search);
  if (p.get("table")) return `QR code table ${p.get("table")!.slice(0, 20)}`;
  if (p.get("room")) return `QR code chambre ${p.get("room")!.slice(0, 20)}`;
  if (p.get("qr")) return "QR code";
  if (p.get("utm_source")) return p.get("utm_source")!.slice(0, 40);
  if (p.get("embed") === "1") return "Bouton site du restaurant";
  let host = "";
  try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* */ }
  if (!host || host === window.location.hostname) return "Accès direct";
  if (/google\./.test(host)) return "Google";
  if (/facebook\.|fb\./.test(host)) return "Facebook";
  if (/instagram\./.test(host)) return "Instagram";
  return host.replace(/^www\./, "").slice(0, 60);
}

/** Suivi anonyme du parcours client : un identifiant aléatoire par visite, aucune donnée personnelle. */
export function useCartAnalytics({ restaurantId, slug, lines, catalog, total, qrActive }: Opts) {
  const send = useServerFn(trackCartSession);
  const key = `lc-cart-session-${slug}`;
  const stage = useRef<{ step: CartStep; page: string } | null>(null);
  const source = useRef<string>("");
  const snap = useRef({ lines, catalog, total });
  snap.current = { lines, catalog, total };

  const sid = useCallback(() => {
    let id = safeSession.get(key);
    if (!id) { id = newId(); safeSession.set(key, id); }
    return id;
  }, [key]);

  const push = useCallback((step: CartStep, page: string, orderId?: string) => {
    if (typeof window === "undefined") return;
    if (!source.current) source.current = provenance();
    const { lines: ls, catalog: cat, total: t } = snap.current;
    const items = ls.flatMap((l) => { const it = cat.itemsById[l.itemId]; return it ? [{ id: it.id.slice(0, 80), name: it.name.slice(0, 120), qty: l.qty, price: Math.round(unitPrice(it, l.sel) * 100) / 100 }] : []; }).slice(0, 80);
    send({ data: { session_id: sid(), restaurant_id: restaurantId, channel: channel(qrActive), step, items, total: t, exit_page: page.slice(0, 80), traffic_source: source.current, ...(orderId ? { order_id: orderId } : {}) } }).catch(() => {});
  }, [send, sid, restaurantId, qrActive]);

  /** Étape explicite (tunnel de commande, paiement, borne). */
  const track = useCallback((step: CartStep, page: string, orderId?: string) => {
    stage.current = step === "completed" ? null : { step, page };
    push(step, page, orderId);
    if (step === "completed") safeSession.remove(key); // visite suivante = nouvelle session
  }, [push, key]);

  /** Nouvelle session (borne : client suivant). */
  const resetSession = useCallback(() => { stage.current = null; safeSession.remove(key); }, [key]);

  // Point d'entrée : une visite de la carte
  useEffect(() => {
    if (window.location.pathname.includes("/suivi/")) return;
    const t = setTimeout(() => push("view_menu", "Carte"), 800);
    return () => clearTimeout(t);
  }, [push]);

  // Chaque ajout/retrait d'article met à jour la session (regroupé)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const s = stage.current;
      const base: CartStep = lines.length ? "add_to_cart" : "view_menu";
      if (s && STEPS.indexOf(s.step) > STEPS.indexOf(base) && lines.length) push(s.step, s.page);
      else { stage.current = null; if (lines.length || safeSession.get(key)) push(base, "Carte"); }
    }, 1200);
    return () => clearTimeout(t);
  }, [lines, push, key]);

  return { track, resetSession };
}
