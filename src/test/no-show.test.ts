import { describe, expect, it } from "vitest";
import { canMarkNoShow } from "@/lib/kitchen-status";
const base = { mode: "pickup", status: "ready", payment_method: "on_site", payment_status: "pending" };
describe("bouton Perte", () => {
  it("visible pour un retrait non réglé", () => expect(canMarkNoShow(base)).toBe(true));
  it("masqué si payé en ligne", () => expect(canMarkNoShow({ ...base, payment_method: "online", payment_status: "paid" })).toBe(false));
  it("masqué en livraison", () => expect(canMarkNoShow({ ...base, mode: "delivery" })).toBe(false));
  it("masqué pour une commande déjà payée au terminal", () => expect(canMarkNoShow({ ...base, payment_method: "card_terminal", payment_status: "paid" })).toBe(false));
});
