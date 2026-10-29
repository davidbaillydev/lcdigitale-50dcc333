import { afterEach, describe, expect, it, vi } from "vitest";
import { customerOrderStage, deliveryStatusPatch, startKitchenReminder } from "@/lib/kitchen-status";

afterEach(() => vi.useRealTimers());
describe("livraisons depuis la cuisine", () => {
  it("conserve la commande dans Prêtes pendant la livraison", () => {
    expect(deliveryStatusPatch("en_route", "2026-10-29T21:30:00Z")).toEqual({ status: "ready", courier_status: "en_route", courier_at: "2026-10-29T21:30:00Z" });
  });
  it("termine la commande et la livraison ensemble", () => {
    expect(deliveryStatusPatch("delivered", "2026-10-29T22:00:00Z")).toEqual({ status: "done", courier_status: "delivered", courier_at: "2026-10-29T22:00:00Z" });
  });
  it("le suivi distingue Prête et En livraison sans modifier le retrait", () => {
    expect(customerOrderStage({ mode: "delivery", status: "ready", courier_status: "assigned" })).toBe("ready");
    expect(customerOrderStage({ mode: "delivery", status: "ready", courier_status: "en_route" })).toBe("en_route");
    expect(customerOrderStage({ mode: "pickup", status: "ready", courier_status: "en_route" })).toBe("ready");
    expect(customerOrderStage({ mode: "delivery", status: "done", courier_status: "delivered" })).toBe("done");
    expect(customerOrderStage({ mode: "delivery", status: "cancelled", courier_status: "en_route" })).toBe("cancelled");
  });
});
describe("rappels sonores cuisine", () => {
  it("sonne toutes les 10 secondes tant que la commande attend acceptation", () => {
    vi.useFakeTimers(); const ring = vi.fn();
    const stop = startKitchenReminder(true, [{ status: "new" }], ring);
    vi.advanceTimersByTime(30_000); expect(ring).toHaveBeenCalledTimes(3);
    stop(); startKitchenReminder(true, [{ status: "accepted" }], ring);
    vi.advanceTimersByTime(30_000); expect(ring).toHaveBeenCalledTimes(3);
  });
  it("continue pour une autre commande non acceptée", () => {
    vi.useFakeTimers(); const ring = vi.fn();
    const stop = startKitchenReminder(true, [{ status: "accepted" }, { status: "pending_approval" }], ring);
    vi.advanceTimersByTime(20_000); expect(ring).toHaveBeenCalledTimes(2); stop();
  });
  it("respecte la coupure volontaire du son", () => {
    vi.useFakeTimers(); const ring = vi.fn();
    startKitchenReminder(false, [{ status: "new" }], ring);
    vi.advanceTimersByTime(30_000); expect(ring).not.toHaveBeenCalled();
  });
});