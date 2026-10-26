import { describe, expect, it, vi } from "vitest";
import { queryKitchenHistory } from "@/lib/kitchen-history";
import type { supabase } from "@/integrations/supabase/client";

function mockClient() {
  const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), gte: vi.fn(), lt: vi.fn(), ilike: vi.fn(), order: vi.fn(), range: vi.fn() };
  Object.values(query).forEach((fn) => fn.mockReturnValue(query));
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as typeof supabase, query, from };
}
describe("Kitchen ticket history", () => {
  it("always limits history to the selected restaurant", () => {
    const { client, query } = mockClient();
    queryKitchenHistory(client, "restaurant-cuisine", { search: "", date: "" }, 0);
    expect(query.eq).toHaveBeenCalledWith("restaurant_id", "restaurant-cuisine");
  });
  it("does not expose awaiting-payment orders to kitchen history", () => {
    const { client, query } = mockClient();
    queryKitchenHistory(client, "restaurant-cuisine", { search: "", date: "" }, 0);
    expect(query.neq).toHaveBeenCalledWith("status", "awaiting_payment");
  });
  it("retrieves an exact order number with bounded pagination", () => {
    const { client, query } = mockClient();
    queryKitchenHistory(client, "restaurant-cuisine", { search: "123", date: "" }, 1);
    expect(query.eq).toHaveBeenCalledWith("order_number", 123);
    expect(query.range).toHaveBeenCalledWith(30, 59);
  });
  it("refuses an unscoped history request", () => {
    const { client, from } = mockClient();
    expect(() => queryKitchenHistory(client, "", { search: "", date: "" }, 0)).toThrow("Restaurant requis");
    expect(from).not.toHaveBeenCalled();
  });
});