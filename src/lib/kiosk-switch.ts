// Changement de borne depuis l'écran de la borne elle-même (appui long), sans retaper l'adresse.
// kioskChoices est pur ; applyKioskId touche le navigateur (stockage local + adresse).
import { normalizeKioskId, type KioskReader } from "./kiosk-readers";

/** Bornes déclarées dans les réglages, avec ou sans TPE propre : proposées au choix sur l'appareil. */
export function kioskChoices(config: unknown): { id: string; label: string }[] {
  const list = (config as { kioskReaders?: unknown } | null)?.kioskReaders;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: { id: string; label: string }[] = [];
  for (const k of list) {
    const id = normalizeKioskId((k as KioskReader)?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = String((k as KioskReader)?.label ?? "").trim().slice(0, 40);
    const repeated = !label || label.toLowerCase() === `borne ${id}` || label.toLowerCase() === id;
    out.push({ id, label: repeated ? "" : label });
  }
  return out;
}

/** Mémorise la borne sur l'appareil et dans l'adresse, sans recharger la page. null = aucune borne. */
export function applyKioskId(slug: string, id: string | null | undefined): string | null {
  const n = normalizeKioskId(id);
  try {
    const key = `kiosk-id:${slug}`;
    if (n) localStorage.setItem(key, n); else localStorage.removeItem(key);
  } catch { /* stockage indisponible : l'adresse suffit */ }
  const url = new URL(window.location.href);
  if (n) url.searchParams.set("borne", n); else url.searchParams.delete("borne");
  window.history.replaceState(null, "", url.toString());
  return n;
}
