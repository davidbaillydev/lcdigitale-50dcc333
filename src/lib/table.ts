import { useEffect, useState } from "react";

const key = (slug: string) => `table-${slug}`;
const qkey = (slug: string) => `qr-${slug}`;

/** Numéro de table issu du QR code scanné (?table=N), mémorisé pour la session du navigateur. */
export function useTable(slug: string, max = 0): string | null {
  const [table, setTable] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("table");
    if (fromUrl && /^[0-9]{1,3}$/.test(fromUrl)) sessionStorage.setItem(key(slug), fromUrl);
    const t = sessionStorage.getItem(key(slug));
    setTable(t && Number(t) >= 1 && Number(t) <= max ? t : null);
  }, [slug, max]);
  return table;
}

export function leaveTable(slug: string) { sessionStorage.removeItem(key(slug)); sessionStorage.removeItem(qkey(slug)); }

export type QrMode = { room: string | null; self: boolean; view: boolean };
type QrCfg = { room?: boolean; self?: boolean } | undefined;

/** Modes QR complémentaires : ?room=102 (room service), ?qr=self (libre-service), ?qr=view (consultation seule). */
export function useQrMode(slug: string, cfg: QrCfg): QrMode {
  const [m, setM] = useState<QrMode>({ room: null, self: false, view: false });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const room = p.get("room");
    const qr = p.get("qr");
    let saved: QrMode = { room: null, self: false, view: false };
    try { saved = { ...saved, ...JSON.parse(sessionStorage.getItem(qkey(slug)) ?? "{}") }; } catch {}
    if (room && /^[A-Za-z0-9-]{1,8}$/.test(room)) saved = { room, self: false, view: false };
    if (qr === "self") saved = { room: null, self: true, view: false };
    if (qr === "view") saved = { room: null, self: false, view: true };
    sessionStorage.setItem(qkey(slug), JSON.stringify(saved));
    setM({ room: cfg?.room ? saved.room : null, self: !!cfg?.self && saved.self, view: saved.view });
  }, [slug, cfg?.room, cfg?.self]);
  return m;
}
