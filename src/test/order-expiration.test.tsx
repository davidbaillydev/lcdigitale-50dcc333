import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { AcceptCountdown } from "@/components/AcceptCountdown";

const mocks = vi.hoisted(() => ({ release: vi.fn(), refund: vi.fn(), push: vi.fn(), token: vi.fn(() => "test-order-token") }));
vi.mock("@/lib/payments/preauth", () => ({ releaseOrder: mocks.release }));
vi.mock("@/lib/refunds.server", () => ({ performRefund: mocks.refund }));
vi.mock("@/lib/push.server", () => ({ notifySubscribers: mocks.push }));
vi.mock("@/lib/customer-access-core.server", () => ({ issueAccessToken: mocks.token }));
import { expireMissedOrders } from "@/lib/order-deadline.server";

const now = Date.parse("2026-11-20T12:00:00Z");
function database(payment: string, ageSeconds: number, mode = "delivery") {
  const row = { id: "order-test", restaurant_id: "restaurant-test", order_number: 123, mode,
    created_at: new Date(now - ageSeconds * 1000).toISOString(),
    accept_deadline: new Date(now - ageSeconds * 1000 + 300_000).toISOString(),
    status: "new", missed_at: null as string | null, payment_status: payment,
    payment_method: payment === "pending" ? "on_site" : "online", currency: "EUR", total: 15,
    refunded_amount: 0, payment_ref: "mollie:test", is_test: false, email: "customer@example.test", customer_name: "Test",
    restaurants: { slug: "test", name: "Restaurant test", email: "staff@example.test" } };
  const db = { from: () => {
    let patch: Record<string, unknown> | null = null;
    const filters: (() => boolean)[] = [];
    const q = {
      select: (_s: string) => q, limit: (_n: number) => q,
      update: (p: Record<string, unknown>) => { patch = p; return q; },
      eq: (k: string, v: unknown) => { filters.push(() => (row as unknown as Record<string, unknown>)[k] === v); return q; },
      is: (k: string, v: unknown) => q.eq(k, v),
      not: (k: string, _op: string, v: unknown) => { filters.push(() => (row as unknown as Record<string, unknown>)[k] !== v); return q; },
      lte: (_k: string, v: string) => { filters.push(() => row.accept_deadline <= v); return q; },
      then: (resolve: (r: { data: typeof row[] }) => unknown) => {
        const matched = filters.every((f) => f());
        if (matched && patch) Object.assign(row, patch);
        return Promise.resolve({ data: matched ? [row] : [] }).then(resolve);
      },
    }; return q;
  } };
  mocks.release.mockImplementation(async () => {
    if (row.payment_status !== "authorized") return false;
    row.payment_status = "released"; row.status = "cancelled"; return true;
  });
  return { row, db: db as unknown as Parameters<typeof expireMissedOrders>[0] };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("five-minute expiry pipeline", () => {
  for (const mode of ["pickup", "takeaway", "dine_in"]) it(`never expires ${mode} even after an old deadline`, async () => {
    const { db, row } = database("authorized", 600, mode);
    expect(await expireMissedOrders(db)).toBe(0);
    expect(row.status).toBe("new");
    expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.refund).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("does not cancel, release, refund or notify at 299 seconds", async () => {
    const { db, row } = database("paid", 299);
    expect(await expireMissedOrders(db)).toBe(0);
    expect(row.status).toBe("new");
    expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.refund).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  for (const payment of ["pending", "authorized", "paid"]) {
    it(`at exactly 300 seconds cancels + missed_at and handles ${payment}, notifying once`, async () => {
      const { db, row } = database(payment, 300);
      expect(await expireMissedOrders(db)).toBe(1);
      expect(row.status).toBe("cancelled"); expect(row.missed_at).toBe(new Date(now).toISOString());
      expect(row.payment_status).toBe(payment === "authorized" ? "released" : payment);
      expect(mocks.refund).toHaveBeenCalledTimes(payment === "paid" ? 1 : 0);
      if (payment === "paid") expect(mocks.refund).toHaveBeenCalledWith(db, row, expect.objectContaining({ key: "refund_order-test_missed" }));
      expect(mocks.push).toHaveBeenCalledWith(db, { order_id: row.id, audience: "customer" }, expect.objectContaining({ url: "/test/suivi/order-test" }));
      expect(await expireMissedOrders(db)).toBe(0); expect(mocks.push).toHaveBeenCalledTimes(1);
    });
  }
  it("sends customer and restaurant expiry emails after cancellation", async () => {
    vi.stubEnv("BREVO_API_KEY", "test"); vi.stubEnv("LOVABLE_API_KEY", "test");
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    const { db } = database("paid", 301);
    await expireMissedOrders(db);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(String((call as unknown as [unknown, RequestInit])[1].body)) as { to: { email: string }[] });
    expect(bodies.flatMap((b) => b.to.map((t) => t.email))).toEqual(["customer@example.test", "staff@example.test"]);
  });
});
describe("customer and kitchen countdowns", () => {
  for (const label of ["En attente de validation par le restaurant", "Temps restant pour accepter"]) {
    it(`runs 300 seconds and fires expiry once: ${label}`, () => {
      const expire = vi.fn();
      const view = render(<AcceptCountdown deadline={new Date(now + 300_000).toISOString()} label={label} onExpire={expire} />);
      expect(expire).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(299_000); }); expect(expire).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1000); }); expect(expire).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(5000); }); expect(expire).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  }
});