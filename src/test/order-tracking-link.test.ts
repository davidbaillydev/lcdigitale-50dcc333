import { describe, expect, it } from "vitest";
import { orderTrackingReturnUrl, orderTrackingSearch } from "@/lib/order-tracking-link";

describe("Checkout tracking handoff", () => {
  it("passes the creation-issued order capability to immediate tracking", () => {
    expect(orderTrackingSearch("signed-order-only-token")).toEqual({ access: "signed-order-only-token" });
  });
  it("passes the order capability to Stripe's return URL", () => {
    const url = new URL(orderTrackingReturnUrl("https://commande.tacos-house.fr", "tacos-house", "order-id", "signed+token/="));
    expect(url.origin).toBe("https://commande.tacos-house.fr");
    expect(url.pathname).toBe("/tacos-house/suivi/order-id");
    expect(url.searchParams.get("access")).toBe("signed+token/=");
  });
  it("preserves the embedded restaurant return link alongside access", () => {
    const back = "https://tacos-house.fr/menu?source=commande&table=1";
    const url = new URL(orderTrackingReturnUrl("https://commande.tacos-house.fr", "tacos-house", "order-id", "signed-order-token", back));
    expect(url.searchParams.get("back")).toBe(back);
    expect(url.searchParams.get("access")).toBe("signed-order-token");
  });
});