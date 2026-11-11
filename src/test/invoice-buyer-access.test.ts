import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  select: vi.fn(),
  adminFrom: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.adminFrom } }));

import { updateInvoiceBuyer } from "@/lib/invoice.functions";

type Invoke = (args: { data: unknown; context: unknown }) => Promise<unknown>;
const invoiceId = "00000000-0000-4000-8000-000000000001";
const restaurantId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";

const buyer = {
  company: "Tacos House",
  siren: "123456789",
  vatNumber: "FR12345678901",
  address: "12 rue des Lilas",
  postalCode: "31770",
  city: "Colomiers",
  email: "compta@tacos-house.fr",
};

/** Lecture RLS du compte appelant : la facture est visible, mais cela ne prouve pas le droit d'écrire. */
const callerClient = {
  from: () => {
    mocks.read();
    return {
      select: (cols: string) => {
        mocks.select(cols);
        return { eq: () => ({ maybeSingle: async () => ({ data: { id: invoiceId, restaurant_id: restaurantId }, error: null }) }) };
      },
    };
  },
  rpc: mocks.rpc,
};

const data = { invoiceId, buyer };

describe("Invoice buyer details write access", () => {
  it("refuses a team member who is not a manager, without touching the invoice table", async () => {
    mocks.read.mockClear(); mocks.select.mockClear(); mocks.adminFrom.mockClear(); mocks.update.mockClear();
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect((updateInvoiceBuyer as unknown as Invoke)({ data, context: { userId, supabase: callerClient } }))
      .rejects.toThrow("Réservé au gérant ou à l'agence");
    expect(mocks.select).toHaveBeenCalledWith("id, restaurant_id");
    expect(mocks.rpc).toHaveBeenCalledWith("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets a manager complete the B2B identity, dated and attributed", async () => {
    mocks.read.mockClear(); mocks.adminFrom.mockClear(); mocks.update.mockClear();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
    mocks.adminFrom.mockReturnValue({ update: mocks.update });
    const res = await (updateInvoiceBuyer as unknown as Invoke)({ data, context: { userId, supabase: callerClient } });
    expect(res).toMatchObject({ ok: true });
    expect(mocks.adminFrom).toHaveBeenCalledWith("restaurant_invoices");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ buyer_b2b: buyer, buyer_b2b_by: userId }));
    expect(mocks.rpc).toHaveBeenCalledWith("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  });

  it("never reaches the write when the invoice is not readable by the caller", async () => {
    mocks.read.mockClear(); mocks.adminFrom.mockClear(); mocks.update.mockClear(); mocks.rpc.mockClear();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const invisible = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      rpc: mocks.rpc,
    };
    await expect((updateInvoiceBuyer as unknown as Invoke)({ data, context: { userId, supabase: invisible } }))
      .rejects.toThrow("Facture introuvable");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
});
