import { describe, it, expect } from "vitest";
import { platformFeeFor } from "@/lib/platform-fee";
describe("commission Mollie 7 % par canal", () => {
  it("applique 7 % sur un canal sélectionné", () => { expect(platformFeeFor(5000, { modes: { delivery: true, pickup: false, dine_in: false, kiosk: false } }, "delivery")).toBe(3.5); });
  it("n'applique rien sur un canal non sélectionné", () => { expect(platformFeeFor(5000, { modes: { delivery: true, pickup: false, dine_in: true, kiosk: false } }, "kiosk")).toBe(0); expect(platformFeeFor(5000, { modes: { pickup: false } }, "pickup")).toBe(0); });
  it("canal non réglé = 7 % (comportement historique)", () => { expect(platformFeeFor(1999, undefined, "pickup")).toBe(1.4); });
});
