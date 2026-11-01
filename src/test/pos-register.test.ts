import { describe, expect, it } from "vitest";
import { changeDue, posEnabled, posPaymentMethod, zReport } from "@/lib/pos-register";

describe("caisse comptoir", () => {
  it("est désactivée par défaut", () => {
    expect(posEnabled({ config: {} })).toBe(false);
    expect(posEnabled({ config: {}, enabled_features: {} })).toBe(false);
    expect(posEnabled(null)).toBe(false);
  });
  it("s'active par le module d'abonnement pos", () => {
    expect(posEnabled({ config: {}, enabled_features: { pos: true } })).toBe(true);
    expect(posEnabled({ config: {}, enabled_features: { pos: false } })).toBe(false);
  });
  it("conserve l'ancien réglage config.pos.enabled", () => {
    expect(posEnabled({ config: { pos: { enabled: true } } })).toBe(true);
    expect(posEnabled({ config: { pos: { enabled: true } }, enabled_features: { pos: false } })).toBe(true);
  });
  it("calcule le rendu de monnaie", () => {
    expect(changeDue(12.5, 20)).toBe(7.5);
    expect(changeDue(12.5, 10)).toBeNull();
  });
  it("mappe CB vers terminal, espèces/titres vers comptoir", () => {
    expect(posPaymentMethod("card")).toBe("card_terminal");
    expect(posPaymentMethod("meal_voucher")).toBe("counter");
  });
  it("ticket Z : totaux par mode et écart espèces", () => {
    const z = zReport([
      { total: 10, status: "done", pos_tender: { method: "cash" } },
      { total: 15, status: "done", pos_tender: { method: "card" } },
      { total: 8, status: "cancelled", pos_tender: { method: "cash" } },
    ], 50, 59);
    expect(z.total).toBe(25);
    expect(z.cancelled).toBe(1);
    expect(z.expectedCash).toBe(60);
    expect(z.cashDifference).toBe(-1);
  });
});
