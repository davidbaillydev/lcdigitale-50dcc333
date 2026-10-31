import { describe, it, expect } from "vitest";
import { modeEnabled, onlinePaymentEnabled, onlineReactivateChoices, type Restaurant } from "@/lib/shop";
const r = (payments: Record<string, boolean>, delivery = true) => ({ config: { payments, modes: { delivery, pickup: true } } }) as unknown as Restaurant;
describe("paiement en ligne et livraison", () => {
  it("réserve le paiement en ligne à la livraison lorsque demandé", () => {
    const restaurant = r({ onlineDeliveryOnly: true });
    expect(onlinePaymentEnabled(restaurant, "delivery")).toBe(true);
    expect(onlinePaymentEnabled(restaurant, "pickup")).toBe(false);
    expect(onlinePaymentEnabled(restaurant, "dine_in")).toBe(false);
  });
  it("autorise tous les modes explicitement ou sans nouvelle option", () => {
    for (const payments of [{}, { onlineDeliveryOnly: false }]) {
      for (const mode of ["delivery", "pickup", "dine_in"] as const) expect(onlinePaymentEnabled(r(payments), mode)).toBe(true);
    }
  });
  it("désactiver le paiement en ligne coupe la livraison", () => {
    expect(onlinePaymentEnabled(r({ online: false }))).toBe(false);
    expect(modeEnabled(r({ online: false }), "delivery")).toBe(false);
    expect(modeEnabled(r({ online: false }), "pickup")).toBe(true);
  });
  it("réactiver le rend immédiatement disponible", () => {
    expect(modeEnabled(r({ online: true }), "delivery")).toBe(true);
    expect(modeEnabled(r({}), "delivery")).toBe(true);
  });
  it("réactiver le paiement alors que la livraison est coupée demande une confirmation explicite", () => {
    expect(onlineReactivateChoices(r({ online: false }, false))).toContain("restore_delivery");
    expect(onlineReactivateChoices(r({ online: false }, false))).toContain("keep_delivery_off");
  });
  it("réactiver le paiement avec la livraison déjà active ne demande pas de confirmation", () => {
    expect(onlineReactivateChoices(r({ online: false }, true))).toHaveLength(0);
  });
});
