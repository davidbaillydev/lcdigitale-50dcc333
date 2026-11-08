import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookie: "", headers: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => new Request("https://restaurant.lcdigitale.fr", { headers: { "cf-connecting-ip": "192.0.2.1" } }), getRequestHeader: () => mocks.cookie, setResponseHeader: mocks.headers }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown }) => h({ ...args, data: validate(args.data) }) }; return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }));
import { grantAccess, issueAccessToken, validAccessToken, requireCustomerAccess } from "@/lib/customer-access.server";
import { getOrderStatus } from "@/lib/orders.functions";
import { getCustomerInvoice } from "@/lib/invoice.functions";
import { getCustomerCreditNotes } from "@/lib/refunds.functions";
import { subscribeOrderPush } from "@/lib/push.functions";
import { confirmReservation } from "@/lib/reservations.functions";
import { startKioskCardPayment, kioskPaymentStatus, cancelKioskPayment, abandonKioskOrder } from "@/lib/payments/terminal";
import { startKioskQrPayment, kioskQrStatus, abandonKioskQr } from "@/lib/payments/kiosk-qr";
import { confirmOnlinePayment } from "@/lib/payments/online";
import { verifyKioskSwitchPin } from "@/lib/kitchen-pin.functions";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
type Call = (args: { data: unknown }) => Promise<unknown>;
beforeEach(() => { vi.clearAllMocks(); mocks.cookie = ""; vi.stubEnv("CUSTOMER_ACCESS_SECRET", "test-only-signing-secret-not-a-production-key"); });
afterEach(() => vi.unstubAllEnvs());
describe("Signed record capabilities", () => {
  it("accepts matching ownership, not another UUID or scope", () => {
    const token = issueAccessToken("order", id);
    expect(validAccessToken(token, "order", id)).toBe(true);
    expect(validAccessToken(token, "order", other)).toBe(false);
    expect(validAccessToken(token, "kiosk", id)).toBe(false);
  });
  it("rejects tampering and expiry", () => {
    const token = issueAccessToken("kiosk", id, 0);
    expect(validAccessToken(token, "kiosk", id, 1800000)).toBe(false);
    expect(validAccessToken(token + "x", "kiosk", id, 0)).toBe(false);
  });
  it("sets a secure HttpOnly cookie and exchanges only a verified handoff", () => {
    const token = issueAccessToken("order", id);
    grantAccess("order", id, token);
    expect(mocks.headers).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly; SameSite=Lax; Max-Age=7776000; Secure"));
    requireCustomerAccess("order", id, token);
    expect(() => requireCustomerAccess("order", other, token)).toThrow("Accès refusé");
  });
});
describe("Private public-endpoint authorization", () => {
  const endpoints: [string, unknown, unknown, "order" | "kiosk" | "reservation"][] = [
    ["status", getOrderStatus, { id }, "order"], ["invoice", getCustomerInvoice, { orderId: id }, "order"],
    ["credit notes", getCustomerCreditNotes, { orderId: id }, "order"], ["push", subscribeOrderPush, { orderId: id, endpoint: "https://push.example/endpoint" }, "order"],
    ["reservation", confirmReservation, { id }, "reservation"], ["terminal start", startKioskCardPayment, { orderId: id }, "kiosk"],
    ["terminal status", kioskPaymentStatus, { orderId: id }, "kiosk"], ["terminal cancel", cancelKioskPayment, { orderId: id }, "kiosk"],
    ["terminal abandon", abandonKioskOrder, { orderId: id }, "kiosk"], ["QR start", startKioskQrPayment, { orderId: id, origin: "https://restaurant.lcdigitale.fr" }, "kiosk"],
    ["QR status", kioskQrStatus, { orderId: id }, "kiosk"], ["QR abandon", abandonKioskQr, { orderId: id }, "kiosk"],
    ["online confirmation", confirmOnlinePayment, { orderId: id }, "order"],
  ];
  it.each(endpoints)("%s refuses missing and cross-record authorization before database access", async (_name, fn, data, scope) => {
    await expect((fn as Call)({ data })).rejects.toThrow("Accès refusé");
    mocks.cookie = `lc_${scope}_${id}=${issueAccessToken(scope, other)}`;
    await expect((fn as Call)({ data })).rejects.toThrow("Accès refusé");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reads status for a matching creation-issued cookie", async () => {
    mocks.cookie = `lc_order_${id}=${issueAccessToken("order", id)}`;
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id, status: "accepted", restaurants: { slug: "fixture", config: {} } } }) };
    mocks.from.mockReturnValue(q);
    expect(await (getOrderStatus as unknown as Call)({ data: { id } })).toMatchObject({ id, status: "accepted" });
  });
  it("PIN throttling refuses the caller without reading or locking shared PINs", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await (verifyKioskSwitchPin as unknown as Call)({ data: { restaurantId: id, pin: "1234" } })).toEqual({ ok: false, reason: "locked" });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_kiosk_pin_attempt", { _caller_key: expect.any(String) });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});