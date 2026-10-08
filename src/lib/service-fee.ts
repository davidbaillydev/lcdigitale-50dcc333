// Frais de service par établissement : fixe (€) ou pourcentage du sous-total, appliqués par canal.
export type ServiceFeeChannel = "delivery" | "pickup" | "dine_in" | "kiosk";
export type ServiceFeeConfig = { enabled: boolean; kind: "fixed" | "percent"; value: number; modes: Record<ServiceFeeChannel, boolean> };

export function serviceFeeDefaults(c?: Partial<ServiceFeeConfig> | null): ServiceFeeConfig {
  return {
    enabled: c?.enabled ?? false, kind: c?.kind === "percent" ? "percent" : "fixed", value: Number(c?.value ?? 0) || 0,
    modes: { delivery: true, pickup: true, dine_in: true, kiosk: true, ...(c?.modes ?? {}) },
  };
}

/** Montant TTC des frais de service (même calcul côté client et serveur). */
export function computeServiceFee(cfg: Partial<ServiceFeeConfig> | null | undefined, subtotal: number, channel: ServiceFeeChannel): number {
  const c = serviceFeeDefaults(cfg);
  if (!c.enabled || c.value <= 0 || !c.modes[channel] || subtotal <= 0) return 0;
  const v = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
  return Math.round(v * 100) / 100;
}

export const serviceFeeLabel = (cfg?: Partial<ServiceFeeConfig> | null) => {
  const c = serviceFeeDefaults(cfg);
  return c.kind === "percent" ? `Frais de service (${String(c.value).replace(".", ",")} %)` : "Frais de service";
};
