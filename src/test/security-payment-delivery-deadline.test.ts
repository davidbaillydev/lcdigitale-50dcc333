import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), expire: vi.fn(), row: vi.fn(), manager: vi.fn(), from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (data: unknown) => data;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (fn: (args: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => fn({ ...args, data: validate(args.data) }) }; return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/customer-access.server", () => ({ requireCustomerAccess: mocks.access }));
vi.mock("@/lib/order-deadline.server", () => ({ expireMissedOrders: mocks.expire }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/payments/shared", () => ({ assertManager: mocks.manager, getRow: mocks.row, admin: vi.fn(), markPaid: vi.fn() }));
import { checkOrderDeadline, checkStaffOrderDeadline } from "@/lib/order-deadline.functions";
import { testLyra } from "@/lib/payments/lyra";
import { publicDeliveryAvailability, isFull } from "@/lib/delivery-capacity.server";
import { capacityBucket } from "@/lib/shop";
type Call = (args: { data: unknown; context?: unknown }) => Promise<unknown>;
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks(); mocks.expire.mockResolvedValue(1);
  mocks.row.mockResolvedValue({ enabled: true, credentials: { siteId: "12345678", key: "test-key", gateway: "https://custom.example/vads-payment/" } });
});
describe("Selected security fixes", () => {
  it("does not contact any saved payment gateway or follow redirects", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await (testLyra as unknown as Call)({ data: { restaurantId: id }, context: { supabase: {}, userId: "agency" } })).toEqual({ mode: "TEST", gateway: "https://custom.example/vads-payment/" });
    expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  });
  it("payment configuration check still rejects unauthorized callers", async () => {
    mocks.manager.mockRejectedValue(new Error("Forbidden"));
    await expect((testLyra as unknown as Call)({ data: { restaurantId: id }, context: { supabase: {}, userId: "other" } })).rejects.toThrow("Forbidden");
    expect(mocks.row).not.toHaveBeenCalled();
  });
  it("public availability contains no order counts or capacity", () => {
    const load = { limit: 3, minutes: 30 as const, counts: { a: 1, b: 2, c: 3, d: 9 } };
    expect(publicDeliveryAvailability(load)).toEqual({ minutes: 30, full: { c: true, d: true } });
    expect(publicDeliveryAvailability({ ...load, limit: null })).toEqual({ minutes: 30, full: {} });
  });
  it("the public full flag agrees with the server capacity rule", () => {
    const iso = "2026-11-20T12:00:00Z";
    const bucket = capacityBucket(iso, 30);
    for (const count of [0, 1, 2, 3, 8]) {
      const load = { limit: 3, minutes: 30 as const, counts: { [bucket]: count } };
      expect(publicDeliveryAvailability(load).full[bucket] === true).toBe(isFull(load, iso));
    }
  });
  it("rejects missing or invalid customer access before cancellation", async () => {
    mocks.access.mockImplementation(() => { throw new Error("Access denied"); });
    await expect((checkOrderDeadline as unknown as Call)({ data: { orderId: id } })).rejects.toThrow("Access denied");
    await expect((checkOrderDeadline as unknown as Call)({ data: { orderId: id, access: "invalid" } })).rejects.toThrow("Access denied");
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it("passes the customer token for cookie-blocked tracking before expiry", async () => {
    expect(await (checkOrderDeadline as unknown as Call)({ data: { orderId: id, access: "signed-order-token" } })).toEqual({ expired: true });
    expect(mocks.access).toHaveBeenCalledWith("order", id, "signed-order-token");
    expect(mocks.expire).toHaveBeenCalledWith(expect.anything(), id);
  });
  it("rejects staff who cannot read the selected order", async () => {
    const query = { select: () => query, eq: () => query, maybeSingle: mocks.maybeSingle };
    const context = { supabase: { from: () => query } };
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect((checkStaffOrderDeadline as unknown as Call)({ data: { orderId: id }, context })).rejects.toThrow("refusé");
    expect(mocks.expire).not.toHaveBeenCalled();
    mocks.maybeSingle.mockResolvedValue({ data: { id }, error: null });
    expect(await (checkStaffOrderDeadline as unknown as Call)({ data: { orderId: id }, context })).toEqual({ expired: true });
    expect(mocks.expire).toHaveBeenCalledWith(expect.anything(), id);
  });
});