import { beforeEach, describe, expect, it } from "vitest";
import { trackingAccess, retainTrackingAccess } from "@/lib/order-tracking-access";

beforeEach(() => window.history.replaceState(null, "", "/"));
describe("Cookie-independent tracking", () => {
  it("keeps the capability for refreshes without exposing it in the address", () => {
    window.history.replaceState({ __TSR_index: 3 }, "", "/suivi/one?access=signed-token&back=https%3A%2F%2Fexample.com&facture=1#ticket");
    expect(trackingAccess("one")).toBe("signed-token");
    retainTrackingAccess("one", "signed-token");
    expect(trackingAccess("one")).toBe("signed-token");
    expect(new URL(window.location.href).searchParams.has("access")).toBe(false);
    expect(new URL(window.location.href).searchParams.get("back")).toBe("https://example.com");
    expect(new URL(window.location.href).searchParams.get("facture")).toBe("1");
    expect(window.location.hash).toBe("#ticket");
    expect(window.history.state.__TSR_index).toBe(3);
  });
  it("never reuses a retained capability for another order", () => {
    retainTrackingAccess("one", "signed-token");
    expect(trackingAccess("two")).toBeUndefined();
  });
});