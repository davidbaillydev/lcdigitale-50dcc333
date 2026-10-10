import { safeSession } from "@/lib/safe-storage";
import { useEffect, useState } from "react";
import { isEmbedded } from "@/lib/embed";

/** En mode intégré (bouton sur le site du restaurant), les paramètres QR n'ont pas de sens. */
function embedded(slug: string): boolean {
  if (!isEmbedded()) return false;
  return new URLSearchParams(window.location.search).get("embed") === "1" || safeSession.get(`embed-${slug}`) === "1";
}

const key = (slug: string) => `table-${slug}`;
const qkey = (slug: string) => `qr-${slug}`;

/** Numéro de table issu du QR code scanné (?table=N), mémorisé pour la session du navigateur. */
export function useTable(slug: string, max = 0): string | null {
  const [table, setTable] = useState<string | null>(null);
  useEffect(() => {
    if (embedded(slug)) { setTable(null); return; }
    const fromUrl = new URLSearchParams(window.location.search).get("table");
    if (fromUrl && /^[0-9]{1,3}$/.test(fromUrl)) safeSession.set(key(slug), fromUrl);
    const t = safeSession.get(key(slug));
    setTable(t && Number(t) >= 1 && Number(t) <= max ? t : null);
  }, [slug, max]);
  return table;
}

export function leaveTable(slug: string) { safeSession.remove(key(slug)); safeSession.remove(qkey(slug)); }

export type QrMode = { room: string | null; self: boolean; view: boolean };
type QrCfg = { room?: boolean; self?: boolean } | undefined;

/** Modes QR complémentaires : ?room=102 (room service), ?qr=self (libre-service), ?qr=view (consultation seule). */
export function useQrMode(slug: string, cfg: QrCfg): QrMode {
  const [m, setM] = useState<QrMode>({ room: null, self: false, view: false });
  useEffect(() => {
    if (embedded(slug)) { setM({ room: null, self: false, view: false }); return; }
    const p = new URLSearchParams(window.location.search);
    const room = p.get("room");
    const qr = p.get("qr");
    let saved: QrMode = { room: null, self: false, view: false };
    try { saved = { ...saved, ...JSON.parse(safeSession.get(qkey(slug)) ?? "{}") }; } catch {}
    if (room && /^[A-Za-z0-9-]{1,8}$/.test(room)) saved = { room, self: false, view: false };
    if (qr === "self") saved = { room: null, self: true, view: false };
    if (qr === "view") saved = { room: null, self: false, view: true };
    safeSession.set(qkey(slug), JSON.stringify(saved));
    setM({ room: cfg?.room ? saved.room : null, self: !!cfg?.self && saved.self, view: saved.view });
  }, [slug, cfg?.room, cfg?.self]);
  return m;
}
