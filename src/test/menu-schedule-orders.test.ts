import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/menu-photos.functions", () => ({ MENU_PHOTO_RE: /^\/api\/public\/menu-photo\/([^/]+)\/.+$/ }));
vi.mock("@/lib/menu-options", () => ({ loadOptionData: async () => ({}), withOptions: (c: unknown) => c }));
vi.mock("@/lib/payments.functions", () => ({ stripeForRestaurant: async () => null }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: restaurant }), then: (resolve: (d: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: mocks.insert, update: mocks.update }; return q;
} } }));
import { createKioskOrder, createOrder } from "@/lib/orders.functions";
import { saveMenu } from "@/lib/menu-admin.functions";
const id = "00000000-0000-4000-8000-000000000001";
const schedule = { days: [1, 2, 3, 4, 5], start: "11:30", end: "14:00" };
const menu = [{ id: "midi", label: "Midi", items: [{ id: "lunch", name: "Menu midi", price: 12, schedule }] }];
const restaurant = { id, slug: "fixture", menu_key: "vierge", menu, config: {}, opening: { "1": [[0, 1440]] }, delivery: { fee: 0, freeFrom: 0, zones: [], minOrder: 0 } };
type Invoke = (args: { data: unknown; context?: unknown }) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
  mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
  mocks.rpc.mockResolvedValue({ data: true });
});
afterEach(() => vi.useRealTimers());
describe("availability in actual order handlers", () => {
  const lines = [{ itemId: "lunch", qty: 1, sel: {} }];
  it("rejects immediate web orders before lunchtime without inserting", async () => {
    await expect((createOrder as unknown as Invoke)({ data: { restaurant: "fixture", mode: "pickup", asap: true, slot: "", first_name: "Test", last_name: "Test", phone: "0600000000", payment_method: "on_site", cgv: true, lines } })).rejects.toThrow("11:30");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects kiosk orders before lunchtime without inserting", async () => {
    await expect((createKioskOrder as unknown as Invoke)({ data: { restaurant: "fixture", mode: "pickup", payment_method: "counter", lines } })).rejects.toThrow("11:30");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("persists schedule through saveMenu validation", async () => {
    await (saveMenu as unknown as Invoke)({ data: { restaurantId: id, menu }, context: { supabase: { rpc: mocks.rpc }, userId: id } });
    expect(mocks.update).toHaveBeenCalledWith({ menu });
  });
});