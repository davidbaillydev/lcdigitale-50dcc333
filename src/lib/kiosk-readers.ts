// Identification des bornes : chaque borne peut avoir son propre TPE physique.
// Pur et sans dépendance : utilisé par la borne (navigateur) et par le serveur.
export type KioskReader = { id: string; label: string; reader: string };

/** Identifiant de borne lisible dans l'URL (?borne=2) : lettres, chiffres, tirets. */
export function normalizeKioskId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
  return s || null;
}

export function kioskReadersOf(config: unknown): KioskReader[] {
  const list = (config as { kioskReaders?: unknown } | null)?.kioskReaders;
  if (!Array.isArray(list)) return [];
  return list.flatMap((k) => {
    const id = normalizeKioskId((k as KioskReader)?.id);
    const reader = typeof (k as KioskReader)?.reader === "string" ? (k as KioskReader).reader.trim() : "";
    return id && reader ? [{ id, label: String((k as KioskReader).label ?? "").slice(0, 40) || `Borne ${id}`, reader }] : [];
  });
}

/** Lecteur propre à la borne ; null = lecteur par défaut du restaurant (fonctionnement actuel). */
export function readerForKiosk(config: unknown, kioskId: string | null | undefined): string | null {
  const id = normalizeKioskId(kioskId);
  if (!id) return null;
  return kioskReadersOf(config).find((k) => k.id === id)?.reader ?? null;
}
