// Commission plateforme Mollie (7 %) : canaux soumis, choisis par l'agence pour chaque restaurant (restaurants.config.platformFee).
export type PlatformFeeChannel = "delivery" | "pickup" | "dine_in" | "kiosk";
export const PLATFORM_FEE_RATE = 0.07;
export const PLATFORM_FEE_CHANNELS: [PlatformFeeChannel, string][] = [
  ["delivery", "Livraison"], ["pickup", "À emporter"], ["dine_in", "Sur place / QR table"], ["kiosk", "Borne"],
];
export type PlatformFeeConfig = { modes: Record<PlatformFeeChannel, boolean> };

/** Canal absent = soumis (comportement historique conservé). */
export function platformFeeDefaults(c?: unknown): PlatformFeeConfig {
  const m = (c as { modes?: Partial<Record<PlatformFeeChannel, unknown>> } | null | undefined)?.modes ?? {};
  return { modes: { delivery: m.delivery !== false, pickup: m.pickup !== false, dine_in: m.dine_in !== false, kiosk: m.kiosk !== false } };
}

/** Commission en euros (arrondie au centime) pour un montant en centimes, 0 si le canal n'est pas sélectionné. */
export function platformFeeFor(amountCents: number, cfg: unknown, channel: PlatformFeeChannel): number {
  if (!platformFeeDefaults(cfg).modes[channel]) return 0;
  return Math.round(amountCents * PLATFORM_FEE_RATE) / 100;
}
