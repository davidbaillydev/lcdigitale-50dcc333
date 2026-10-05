import { useEffect, useState } from "react";

const key = (slug: string) => `table-${slug}`;

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

export function leaveTable(slug: string) { sessionStorage.removeItem(key(slug)); }
