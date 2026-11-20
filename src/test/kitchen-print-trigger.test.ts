import { describe, expect, it } from "vitest";
import { KitchenAutoPrintClaims, shouldAutoPrint } from "@/lib/kitchen-print-trigger";
import { autoPrintKinds, printingDefaults } from "@/lib/ticket";

describe("kitchen automatic print trigger", () => {
  it("preserves arrival for existing restaurants and accepts the new selection", () => {
    expect(printingDefaults().trigger).toBe("arrival");
    expect(printingDefaults({ trigger: "acceptance" }).trigger).toBe("acceptance");
  });
  it("never prints a newly arrived order when acceptance is selected", () => {
    expect(shouldAutoPrint("acceptance", "arrival", "new")).toBe(false);
  });
  it("prints only after confirmed acceptance, including a delayed acceptance", () => {
    expect(shouldAutoPrint("acceptance", "acceptance", "accepted")).toBe(true);
    for (const status of ["new", "pending_approval", "awaiting_payment", "cancelled"]) {
      expect(shouldAutoPrint("acceptance", "acceptance", status)).toBe(false);
    }
  });
  it("arrival prints released or automatically accepted orders, not unpaid or pending approvals", () => {
    for (const status of ["new", "accepted"]) expect(shouldAutoPrint("arrival", "arrival", status)).toBe(true);
    for (const status of ["awaiting_payment", "pending_approval", "cancelled"]) expect(shouldAutoPrint("arrival", "arrival", status)).toBe(false);
    expect(shouldAutoPrint("arrival", "acceptance", "accepted")).toBe(false);
  });
  it("rush adds receipt without changing the selected trigger", () => {
    const p = { ...printingDefaults({ trigger: "acceptance", autoKitchen: true }), autoReceipt: true };
    expect(autoPrintKinds(p)).toEqual(["kitchen", "receipt"]);
    expect(shouldAutoPrint(p.trigger, "arrival", "new")).toBe(false);
    expect(shouldAutoPrint(p.trigger, "acceptance", "accepted")).toBe(true);
  });
  it("deduplicates direct acceptance, realtime echoes and deferred payment callbacks per ticket", () => {
    const claims = new KitchenAutoPrintClaims();
    expect(claims.take("order1", ["kitchen", "receipt"])).toEqual(["kitchen", "receipt"]);
    expect(claims.take("order1", ["kitchen", "receipt"])).toEqual([]);
    expect(claims.take("order2", ["kitchen"])).toEqual(["kitchen"]);
    expect(claims.take("order2", ["kitchen", "receipt"])).toEqual(["receipt"]);
  });
});