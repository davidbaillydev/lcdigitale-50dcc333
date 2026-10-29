import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/menu-photos.functions", () => ({ MENU_PHOTO_RE: /^\/api\/public\/menu-photo\/([^/]+)\/.+$/ }));
vi.mock("@/lib/menu-options", () => ({ loadOptionData: async () => ({}), withOptions: (c: unknown) => c }));
vi.mock("@/lib/payments.functions", () => ({ stripeForRestaurant: async () => null, stripeCall: vi.fn(), startOnlinePayment: vi.fn() }));
vi.mock("@/lib/promo.server", () => ({ resolveDiscount: async () => ({ discount: 0, code: null }) }));
vi.mock("@/lib/pos.server", () => ({ syncOrderToPos: async () => ({ status: "skipped" }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: restaurant }), then: (resolve: (d: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: mocks.insert }; return q;
} } }));
import { createOrder } from "@/lib/orders.functions";
const id = "00000000-0000-4000-8000-000000000001";
const menu = [{ id: "plats", label: "Plats", items: [{ id: "wok", name: "Wok poulet", price: 10 }] }];
const restaurant = { id, slug: "fixture", menu_key: "vierge", menu, config: {}, opening: { "1": [[0, 1440]] }, delivery: { fee: 0, freeFrom: 0, zones: [], minOrder: 0 } };
type Invoke = (args: { data: unknown; context?: unknown }) => Promise<unknown>;
const base = { restaurant: "fixture", asap: false, slot: "2026-10-26T11:00:00Z", first_name: "Test", last_name: "Test", phone: "0600000000", cgv: true, lines: [{ itemId: "wok", qty: 1, sel: {} }] };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "order-1", order_number: 1 }, error: null }) }) });
});
afterEach(() => vi.useRealTimers());
describe("livraison : paiement en ligne obligatoire", () => {
  it("refuse une livraison payée en mains propres, sans insérer", async () => {
    await expect((createOrder as unknown as Invoke)({ data: { ...base, mode: "delivery", payment_method: "on_site", address: "1 rue de Test", postal_code: "31770" } })).rejects.toThrow("La livraison nécessite un paiement en ligne.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("accepte une livraison payée en ligne", async () => {
    await (createOrder as unknown as Invoke)({ data: { ...base, mode: "delivery", payment_method: "online", address: "1 rue de Test", postal_code: "31770" } });
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ mode: "delivery", payment_method: "online" });
  });
});
describe("paiement en mains propres : retrait uniquement", () => {
  it("accepte un retrait payé en mains propres", async () => {
    await (createOrder as unknown as Invoke)({ data: { ...base, mode: "pickup", payment_method: "on_site" } });
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ mode: "pickup", payment_method: "on_site" });
  });
  it("refuse le paiement en mains propres quand le restaurant l'a désactivé", async () => {
    restaurant.config = { payments: { on_site: false } };
    await expect((createOrder as unknown as Invoke)({ data: { ...base, mode: "pickup", payment_method: "on_site" } })).rejects.toThrow("Ce mode de paiement n'est pas accepté.");
    expect(mocks.insert).not.toHaveBeenCalled();
    restaurant.config = {};
  });
});
