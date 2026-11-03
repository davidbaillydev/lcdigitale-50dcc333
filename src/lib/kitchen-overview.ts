/** Début du service du jour (minuit, heure locale de l'écran) — aligné sur l'écran cuisine. */
export function startOfTodayIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Statuts visibles sur l'écran cuisine (hors attente de paiement). */
export const ACTIVE_STATUSES = ["new", "pending_approval", "accepted", "ready"] as const;

/** Nombre de commandes réelles encore ouvertes en cuisine. */
export function countActive(orders: { status: string; is_test?: boolean }[]): number {
  return orders.filter((o) => !o.is_test && (ACTIVE_STATUSES as readonly string[]).includes(o.status)).length;
}

/** Répartition par colonne cuisine pour la vue d'ensemble. */
export function activeBreakdown(orders: { status: string; is_test?: boolean }[]): { fresh: number; cooking: number; ready: number } {
  const real = orders.filter((o) => !o.is_test);
  return {
    fresh: real.filter((o) => o.status === "new" || o.status === "pending_approval").length,
    cooking: real.filter((o) => o.status === "accepted").length,
    ready: real.filter((o) => o.status === "ready").length,
  };
}
