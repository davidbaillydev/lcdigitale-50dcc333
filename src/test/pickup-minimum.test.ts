import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/menu-photos.functions", () => ({ MENU_PHOTO_RE: /^\/api\/public\/menu-photo\/([^/]+)\/.+$/ }));
vi.mock("@/lib/menu-options", () => ({ loadOptionData: async () => ({}), withOptions: (c: unknown) => c }));
vi.mock("@/lib/payments.functions", () => ({ stripeForRestaurant: async () => ({}), stripeCall: async () => ({ id: "pi_test", client_secret: "secret_test" }), startOnlinePayment: vi.fn() }));
vi.mock("@/lib/promo.server", () => ({ resolveDiscount: async () => ({ discount: 0, code: null }) }));
vi.mock("@/lib/pos.server", () => ({ syncOrderToPos: async () => ({ status: "skipped" }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: restaurant }), then: (resolve: (d: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: mocks.insert, update: () => ({ eq: async () => ({ error: null }) }) }; return q;
} } }));
import { createOrder } from "@/lib/orders.functions";
import { pickupMinOrder } from "@/lib/shop";
const id = "00000000-0000-4000-8000-000000000001";
const menu = [{ id: "plats", label: "Plats", items: [{ id: "wok", name: "Wok poulet", price: 10 }] }];
const restaurant = { id, slug: "fixture", menu_key: "vierge", menu, config: {} as Record<string, unknown>, opening: { "1": [[0, 1440]] }, delivery: { fee: 0, freeFrom: 0, zones: [], minOrder: 0 } };
type Invoke = (args: { data: unknown; context?: unknown }) => Promise<unknown>;
const base = { restaurant: "fixture", asap: false, slot: "2026-10-26T11:00:00Z", first_name: "Test", last_name: "Test", phone: "0600000000", cgv: true, mode: "pickup", payment_method: "on_site", lines: [{ itemId: "wok", qty: 1, sel: {} }] };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
  restaurant.config = {};
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "order-1", order_number: 1 }, error: null }) }) });
});
afterEach(() => vi.useRealTimers());
describe("minimum de commande à emporter", () => {
  it("aucun minimum par défaut : toute commande à emporter passe", async () => {
    await (createOrder as unknown as Invoke)({ data: base });
    expect(mocks.insert).toHaveBeenCalled();
  });
  it("refuse un retrait sous le minimum configuré, sans insérer", async () => {
    restaurant.config = { pickupMinOrder: 15 };
    await expect((createOrder as unknown as Invoke)({ data: base })).rejects.toThrow("Minimum de commande à emporter : 15 €");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("accepte un retrait au minimum exact ou au-dessus", async () => {
    restaurant.config = { pickupMinOrder: 15 };
    await (createOrder as unknown as Invoke)({ data: { ...base, lines: [{ itemId: "wok", qty: 2, sel: {} }] } });
    expect(mocks.insert).toHaveBeenCalled();
  });
  it("pickupMinOrder ignore les valeurs absentes, nulles ou nulles/négatives", () => {
    expect(pickupMinOrder({ config: {} } as never)).toBeNull();
    expect(pickupMinOrder({ config: { pickupMinOrder: null } } as never)).toBeNull();
    expect(pickupMinOrder({ config: { pickupMinOrder: 0 } } as never)).toBeNull();
    expect(pickupMinOrder({ config: { pickupMinOrder: 12.5 } } as never)).toBe(12.5);
  });
});
