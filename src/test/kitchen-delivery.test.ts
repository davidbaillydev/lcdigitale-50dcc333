import { describe, expect, it } from "vitest";
import { kitchenDeliveryInfo } from "@/lib/kitchen-delivery";

describe("kitchen delivery information", () => {
  it("retains street, postal code and city", () => {
    expect(kitchenDeliveryInfo({ address: " 12 rue du Centre ", postal_code: "31770", city: "Colomiers" }).address).toBe("12 rue du Centre, 31770 Colomiers");
  });
  it("calculates kilometres from the restaurant", () => {
    const info = kitchenDeliveryInfo({ delivery_lat: 43.6045, delivery_lng: 1.444 }, [43.61, 1.335]);
    expect(info.km).toBeGreaterThan(8);
    expect(info.km).toBeLessThan(10);
  });
  it("never invents missing distances", () => {
    expect(kitchenDeliveryInfo({ delivery_lat: null, delivery_lng: null }, [43.61, 1.335]).km).toBeNull();
    expect(kitchenDeliveryInfo({ delivery_lat: 43.61, delivery_lng: 1.335 }).km).toBeNull();
  });
  it("rejects invalid coordinates and preserves zero", () => {
    expect(kitchenDeliveryInfo({ delivery_lat: 100, delivery_lng: 1 }, [0, 0]).km).toBeNull();
    expect(kitchenDeliveryInfo({ delivery_lat: 0, delivery_lng: 0 }, [0, 0]).km).toBe(0);
  });
  it("uses the saved delivery zone only", () => {
    expect(kitchenDeliveryInfo({ zone_name: " Centre " }).zone).toBe("Centre");
    expect(kitchenDeliveryInfo({}).zone).toBeNull();
  });
});