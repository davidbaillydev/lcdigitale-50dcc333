import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ insert: vi.fn(), rpc: vi.fn(), bank: vi.fn(), pos: vi.fn(), email: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context?: unknown }) => h({ ...args, data: validate(args.data) }) }; return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/menu-options", () => ({ loadOptionData: async () => ({}), withOptions: (c: unknown) => c }));
vi.mock("@/lib/payments.functions", () => ({ stripeForRestaurant: m.bank, stripeCall: m.bank, startOnlinePayment: m.bank }));
vi.mock("@/lib/pos.server", () => ({ syncOrderToPos: m.pos }));
vi.mock("@/lib/order-email.server", () => ({ notifyNewOrder: m.email }));
vi.mock("@/lib/promo.server", () => ({ resolveDiscount: async () => ({ discount: 0, code: null }) }));
vi.mock("@/lib/delivery-capacity.server", () => ({ deliveryLoad: async () => ({}), isFull: () => false }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: restaurant }), then: (resolve: (d: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: (data: unknown) => { m.insert(data); return { select: () => ({ single: async () => ({ data: { id: "00000000-0000-4000-8000-000000000002", order_number: 1, total: 23.5 }, error: null }) }) }; } }; return q;
} } }));
import { createAdminTestOrder, createOrder } from "@/lib/orders.functions";
import { issueForOrder } from "@/lib/invoice.server";
const restaurant = { id: "00000000-0000-4000-8000-000000000001", slug: "fixture", menu_key: "vierge", menu: [{ id: "food", label: "Plats", items: [{ id: "dish", name: "Plat", price: 10 }] }], config: { serviceFee: { enabled: true, kind: "fixed", value: 1, modes: { delivery: true, pickup: false, dine_in: false, kiosk: false } } }, opening: { "4": [[0, 1440]] }, delivery: { fee: 2.5, freeFrom: 40, minOrder: 15, zones: [{ cp: "31770", city: "Colomiers" }] } };
const input = { restaurant: "fixture", mode: "delivery", asap: true, slot: "", first_name: "Admin", last_name: "Test", phone: "0600000000", address: "1 rue de test", postal_code: "31770", payment_method: "online", cgv: true, lines: [{ itemId: "dish", qty: 2, sel: {} }] };
type Invoke = (args: { data: unknown; context?: unknown }) => Promise<unknown>;
const invoke = (data = input) => (createAdminTestOrder as unknown as Invoke)({ data, context: { userId: restaurant.id, supabase: { rpc: m.rpc } } });
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T13:54:00Z")); m.rpc.mockResolvedValue({ data: true, error: null }); });
afterEach(() => vi.useRealTimers());
describe("CB Test (Admin)", () => {
  it("refuse un gérant/cuisine/non administrateur avant toute écriture", async () => {
    m.rpc.mockResolvedValue({ data: false }); await expect(invoke()).rejects.toThrow("réservé"); expect(m.insert).not.toHaveBeenCalled(); expect(m.bank).not.toHaveBeenCalled();
  });
  it("refuse quand la vérification des droits échoue", async () => {
    m.rpc.mockResolvedValue({ data: true, error: new Error("unavailable") }); await expect(invoke()).rejects.toThrow("réservé"); expect(m.insert).not.toHaveBeenCalled();
  });
  it("recalcule livraison et frais fixes sans banque, POS ou email", async () => {
    await invoke(); expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 20, delivery_fee: 2.5, service_fee: 1, total: 23.5, is_test: true, test_created_by: restaurant.id, payment_method: "online", payment_status: "paid", status: "new", payment_ref: expect.stringMatching(/^admin-test:/) }));
    expect(m.bank).not.toHaveBeenCalled(); expect(m.pos).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled();
  });
  it("respecte le franco de livraison et ignore les prix falsifiés", async () => {
    await invoke({ ...input, total: 0, lines: [{ itemId: "dish", qty: 4, sel: {} }] } as typeof input); expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 40, delivery_fee: 0, service_fee: 1, total: 41 }));
  });
  it("ne permet pas au chemin public de simuler un paiement", async () => {
    m.bank.mockResolvedValue(null);
    await expect((createOrder as unknown as Invoke)({ data: { ...input, is_test: true, test_created_by: restaurant.id } })).rejects.toThrow("paiement en ligne"); expect(m.insert).not.toHaveBeenCalled();
  });
  it("calcule les frais de service à 7 % du sous-total", async () => {
    restaurant.config.serviceFee.kind = "percent"; restaurant.config.serviceFee.value = 7;
    try { await invoke(); expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 20, delivery_fee: 2.5, service_fee: 1.4, total: 23.9 })); }
    finally { restaurant.config.serviceFee.kind = "fixed"; restaurant.config.serviceFee.value = 1; }
  });
  it("refuse une adresse hors zone", async () => { await expect(invoke({ ...input, postal_code: "75001" })).rejects.toThrow("hors de notre zone"); expect(m.insert).not.toHaveBeenCalled(); });
  it("refuse le minimum de livraison non atteint", async () => { await expect(invoke({ ...input, lines: [{ itemId: "dish", qty: 1, sel: {} }] })).rejects.toThrow("Minimum"); expect(m.insert).not.toHaveBeenCalled(); });
  it("interdit la facture pour un paiement simulé", async () => {
    const db = { from: (table: string) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === "orders" ? { is_test: true } : null }) }; return q; }, rpc: vi.fn() };
    await expect(issueForOrder(db as unknown as Parameters<typeof issueForOrder>[0], "test")).rejects.toThrow("aucune facture"); expect(db.rpc).not.toHaveBeenCalled();
  });
});