import { describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown }) => h({ ...args, data: validate(args.data) }) }; return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: m.from } }));
vi.mock("@/lib/promo.server", () => ({ resolveDiscount: m.resolve }));
vi.mock("@/lib/catalogs", () => ({ getCatalog: () => ({ categories: [] }) }));
import { checkDiscount } from "@/lib/marketing.functions";
it("public previews never pass submitted contact identifiers to order-history eligibility", async () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "restaurant", config: {} } }) };
  m.from.mockReturnValue(q); m.resolve.mockResolvedValue({ discount: 0, code: null, label: "" });
  const invoke = checkDiscount as unknown as (args: { data: unknown }) => Promise<unknown>;
  const base = { slug: "fixture", subtotal: 20, channel: "web" };
  expect(await invoke({ data: { ...base, email: "existing@example.com", phone: "0600000000" } })).toEqual(await invoke({ data: { ...base, email: "new@example.com", phone: "0611111111" } }));
  const opts = m.resolve.mock.calls[0]?.[3];
  expect(opts).not.toHaveProperty("email"); expect(opts).not.toHaveProperty("phone");
  expect(m.from).toHaveBeenCalledTimes(2); expect(m.from).toHaveBeenCalledWith("restaurants");
});