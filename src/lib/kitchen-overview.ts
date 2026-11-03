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

/** Commandes comptées en direct : créées depuis minuit (même borne que l'écran cuisine). */
export function todaysOrders<T extends { created_at: string }>(orders: T[], now: Date = new Date()): T[] {
  const since = startOfTodayIso(now);
  return orders.filter((o) => new Date(o.created_at).toISOString() >= since);
}

/** Règle de clôture automatique (miroir de la tâche horaire en base). */
export const AUTO_CLOSE_STATUSES = ["accepted", "ready"] as const;
export const AUTO_CLOSE_AFTER_MS = 24 * 60 * 60 * 1000;
export function shouldAutoClose(o: { status: string; created_at: string }, now: Date = new Date()): boolean {
  return (AUTO_CLOSE_STATUSES as readonly string[]).includes(o.status) && now.getTime() - new Date(o.created_at).getTime() > AUTO_CLOSE_AFTER_MS;
}
