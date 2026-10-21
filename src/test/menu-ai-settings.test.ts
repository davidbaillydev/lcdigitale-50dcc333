import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), del: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (h: unknown) => h }; return builder;
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { getMenuAiSettings, saveMenuAiKey, removeMenuAiKey } from "@/lib/menu-ai-settings.functions";
type Invocation = (input: { context: { supabase: { rpc: typeof mocks.rpc }; userId: string }; data?: { apiKey: string } }) => Promise<unknown>;
const context = { supabase: { rpc: mocks.rpc }, userId: "admin-fixture" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "gemini" }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.del.mockReturnValue({ eq: async () => ({ error: null }) });
  const query = { select: () => query, eq: () => query, maybeSingle: mocks.maybeSingle, upsert: mocks.upsert, delete: mocks.del };
  mocks.from.mockReturnValue(query);
});
describe("Agency Gemini key permissions", () => {
  it.each([getMenuAiSettings, saveMenuAiKey, removeMenuAiKey])("rejects non-agency access before touching credentials", async (fn) => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect((fn as unknown as Invocation)({ context, data: { apiKey: "fixture" } })).rejects.toThrow("Réservé");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns presence only", async () => {
    expect(await (getMenuAiSettings as unknown as Invocation)({ context })).toEqual({ configured: true, fallbackReason: null, fallbackAt: null });
  });
  it("saves the shared key without returning it", async () => {
    expect(await (saveMenuAiKey as unknown as Invocation)({ context, data: { apiKey: "fixture" } })).toEqual({ configured: true });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "gemini", api_key: "fixture" }));
  });
  it("removes the credential", async () => {
    expect(await (removeMenuAiKey as unknown as Invocation)({ context })).toEqual({ configured: false });
    expect(mocks.del).toHaveBeenCalledOnce();
  });
});