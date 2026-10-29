// Chick'N Co (Gaillac) : zone 81600, frais 5 €, minimum 20 €, gratuite dès 40 €, livraison payée en ligne (Mollie).
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), startOnlinePayment: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/menu-photos.functions", () => ({ MENU_PHOTO_RE: /^\/api\/public\/menu-photo\/([^/]+)\/.+$/ }));
vi.mock("@/lib/menu-options", () => ({ loadOptionData: async () => ({}), withOptions: (c: unknown) => c }));
vi.mock("@/lib/payments.functions", () => ({ stripeForRestaurant: async () => null, stripeCall: async () => ({}), startOnlinePayment: mocks.startOnlinePayment }));
vi.mock("@/lib/promo.server", () => ({ resolveDiscount: async () => ({ discount: 0, code: null }) }));
vi.mock("@/lib/pos.server", () => ({ syncOrderToPos: async () => ({ status: "skipped" }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: restaurant }), then: (resolve: (d: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: mocks.insert, update: () => ({ eq: async () => ({ error: null }) }) }; return q;
} } }));
import { createOrder } from "@/lib/orders.functions";

const menu = [{ id: "c", label: "Plats", items: [{ id: "assiette", name: "Assiette", price: 12.5 }] }];
const restaurant = {
  id: "0208151b-2607-4041-93d2-c20b6c35591f", slug: "chick-n-co", name: "Chick'N Co", menu_key: "vierge", menu, config: {},
  opening: { "1": [[690, 870], [1110, 1350]] },
  delivery: { fee: 5, minOrder: 20, freeFrom: 40, zones: [{ cp: "81600", city: "Gaillac" }] },
};
type Invoke = (args: { data: unknown }) => Promise<unknown>;
// Lundi 26/10/2026 12:00 Paris
const order = (qty: number, postal_code = "81600", payment_method = "online") => (createOrder as unknown as Invoke)({ data: {
  restaurant: "chick-n-co", asap: false, slot: "2026-10-26T11:00:00Z", first_name: "A", last_name: "B", phone: "0600000000", cgv: true,
  mode: "delivery", payment_method, provider: "mollie", origin: "https://restaurant.lcdigitale.fr", address: "1 place de la Libération", postal_code,
  lines: [{ itemId: "assiette", qty, sel: {} }],
} });

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "o1", order_number: 1, total: 0 }, error: null }) }) });
  mocks.startOnlinePayment.mockResolvedValue({ url: "https://mollie.test/checkout" });
});
afterEach(() => vi.useRealTimers());

describe("Chick'N Co : livraison Gaillac", () => {
  it("facture 5 € de livraison sous 40 €", async () => {
    await order(2); // 25 €
    expect(mocks.insert.mock.calls[0]?.[0]).toMatchObject({ subtotal: 25, delivery_fee: 5, total: 30, city: "Gaillac", status: "awaiting_payment" });
  });
  it("livraison gratuite dès 40 €", async () => {
    await order(4); // 50 €
    expect(mocks.insert.mock.calls[0]?.[0]).toMatchObject({ subtotal: 50, delivery_fee: 0, total: 50 });
  });
  it("refuse sous le minimum de 20 €", async () => {
    await expect(order(1)).rejects.toThrow("Minimum de commande en livraison : 20 €");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("refuse un code postal hors zone", async () => {
    await expect(order(2, "81000")).rejects.toThrow("hors de notre zone");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("refuse la livraison payée à la remise", async () => {
    await expect(order(2, "81600", "on_site")).rejects.toThrow("La livraison nécessite un paiement en ligne.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("passe par Mollie et reste cachée de la cuisine avant paiement", async () => {
    await order(2);
    expect(mocks.startOnlinePayment).toHaveBeenCalledWith("mollie", expect.objectContaining({ restaurant_id: restaurant.id }), expect.anything(), expect.any(String), "delivery");
  });
});
