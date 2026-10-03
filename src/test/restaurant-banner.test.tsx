import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RestaurantBanner } from "@/components/RestaurantBanner";
import type { Restaurant } from "@/lib/shop";

const restaurant: Restaurant = {
  id: "12345678-1234-1234-1234-123456789012", name: "Restaurant test", slug: "test", city: null, address: null,
  phone: null, email: null, menu_key: "vierge", logo_url: "data:image/png;base64,logo", menu: null,
  brand: { primary: "#123456", accent: "#654321" }, opening: {}, config: {}, delivery: { minOrder: 0, fee: 0, freeFrom: 0, zones: [] },
};
afterEach(cleanup);
describe("Restaurant banner", () => {
  it("shows brand and logo when no banner exists", () => {
    const { container, getByAltText } = render(<RestaurantBanner restaurant={restaurant} />);
    expect(container.querySelector("[data-banner-fallback]")).not.toBeNull();
    expect(getByAltText("Logo Restaurant test")).toBeTruthy();
  });
  it("falls back to logo when a banner cannot load", () => {
    const { container, getByAltText } = render(<RestaurantBanner restaurant={{ ...restaurant, brand: { bannerPath: "test/image.jpg" } }} />);
    fireEvent.error(getByAltText("Bannière de Restaurant test"));
    expect(container.querySelector("[data-banner-fallback]")).not.toBeNull();
    expect(getByAltText("Logo Restaurant test")).toBeTruthy();
  });
  it("shows the brand fallback for a staged removal", () => {
    const { container } = render(<RestaurantBanner restaurant={{ ...restaurant, brand: { bannerPath: "test/image.jpg" } }} preview={null} />);
    expect(container.querySelector("[data-banner-fallback]")).not.toBeNull();
  });
});