import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (h: (d: unknown) => unknown) => (args: { data: unknown; context: unknown }) => h({ ...args, data: validate(args.data) }) }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { listMenuTemplates, publishMenuTemplate } from "@/lib/menu-templates.functions";
type Invoke = (args: { data: unknown; context: unknown }) => Promise<unknown>;
const id = "00000000-0000-4000-8000-000000000001";
describe("template permissions", () => {
  it("refuses publication by a restaurant manager without touching the template table", async () => {
    mocks.from.mockClear(); mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect((publishMenuTemplate as unknown as Invoke)({ data: { restaurantId: id, name: "Tacos House" }, context: { userId: id, supabase: { rpc: mocks.rpc } } })).rejects.toThrow("Réservé à l’agence");
    expect(mocks.rpc).toHaveBeenCalledWith("has_role", { _user_id: id, _role: "admin" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("refuses library access to staff or a manager of another restaurant", async () => {
    mocks.from.mockClear(); mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect((listMenuTemplates as unknown as Invoke)({ data: { restaurantId: id }, context: { userId: id, supabase: { rpc: mocks.rpc } } })).rejects.toThrow("Accès réservé");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});