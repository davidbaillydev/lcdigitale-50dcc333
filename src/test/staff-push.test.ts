import { beforeEach, describe, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn(async () => 201));
vi.mock("@/lib/push.server", () => ({ sendEmptyPush: send }));
import { hashDeviceToken, notifyStaffOrder } from "@/lib/staff-push.server";
import { webcrypto } from "node:crypto";
type Admin = Parameters<typeof notifyStaffOrder>[0];
const order = { id: "order", restaurant_id: "restaurant", status: "new", is_test: false, source: "web", restaurants: { name: "Restaurant", slug: "restaurant" } };
function database({ allowed = true, duplicate = false, test = false, status = "new" } = {}) {
  const insert = vi.fn(async () => ({ error: duplicate ? { code: "23505" } : null }));
  const rpc = vi.fn(async () => ({ data: allowed, error: null }));
  return { insert, rpc, admin: { rpc, from: (table: string) => {
    const q = { select: () => q, eq: () => q, contains: () => q, gt: async () => ({ data: [{ id: "device", endpoint: "https://fcm.googleapis.com/device", user_id: "user" }] }), maybeSingle: async () => ({ data: { ...order, status, is_test: test } }), insert };
    return q;
  } } as unknown as Admin };
}
beforeEach(() => { send.mockClear(); });
describe("staff background push", () => {
  it("rechecks current access before sending a generic notification", async () => {
    const db = database();
    expect(await notifyStaffOrder(db.admin, "order")).toBe(1);
    expect(db.rpc).toHaveBeenCalledWith("can_access_restaurant", { _user_id: "user", _restaurant_id: "restaurant" });
    expect(db.insert).toHaveBeenCalledWith({ device_id: "device", order_id: "order", restaurant_id: "restaurant", title: "Restaurant", url: "/espace/restaurant" });
  });
  it("does not send after access revocation", async () => { expect(await notifyStaffOrder(database({ allowed: false }).admin, "order")).toBe(0); expect(send).not.toHaveBeenCalled(); });
  it("does not resend a claimed device/order notification", async () => { expect(await notifyStaffOrder(database({ duplicate: true }).admin, "order")).toBe(0); expect(send).not.toHaveBeenCalled(); });
  it("excludes test orders from external notifications", async () => { expect(await notifyStaffOrder(database({ test: true }).admin, "order")).toBe(0); expect(send).not.toHaveBeenCalled(); });
  it("excludes unpaid orders", async () => { expect(await notifyStaffOrder(database({ status: "awaiting_payment" }).admin, "order")).toBe(0); expect(send).not.toHaveBeenCalled(); });
  it("stores only a deterministic hash of the device capability", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const hash = await hashDeviceToken("device-token");
    expect(hash).toHaveLength(64); expect(hash).not.toContain("device-token");
    expect(await hashDeviceToken("other-token")).not.toBe(hash);
    vi.unstubAllGlobals();
  });
});