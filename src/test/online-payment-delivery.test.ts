import { describe, it, expect } from "vitest";
import { modeEnabled, onlinePaymentEnabled, type Restaurant } from "@/lib/shop";
const r = (payments: Record<string, boolean>) => ({ config: { payments, modes: { delivery: true, pickup: true } } }) as unknown as Restaurant;
describe("paiement en ligne et livraison", () => {
  it("désactiver le paiement en ligne coupe la livraison", () => {
    expect(onlinePaymentEnabled(r({ online: false }))).toBe(false);
    expect(modeEnabled(r({ online: false }), "delivery")).toBe(false);
    expect(modeEnabled(r({ online: false }), "pickup")).toBe(true);
  });
  it("réactiver le rend immédiatement disponible", () => {
    expect(modeEnabled(r({ online: true }), "delivery")).toBe(true);
    expect(modeEnabled(r({}), "delivery")).toBe(true);
  });
});
