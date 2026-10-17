import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), listUsers: vi.fn(), invite: vi.fn(), upsert: vi.fn(), maybeSingle: vi.fn(), getUser: vi.fn(), rows: [] as { user_id: string; created_at: string }[] }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  auth: { admin: { listUsers: mocks.listUsers, inviteUserByEmail: mocks.invite, getUserById: mocks.getUser } },
  from: () => { const query = { select: () => query, eq: () => query, order: async () => ({ data: mocks.rows, error: null }), maybeSingle: mocks.maybeSingle, upsert: mocks.upsert }; return query; },
} }));
import { inviteAgencyAdmin, listAgencyAdmins } from "@/lib/agency-admins.functions";
type Context = { userId: string; supabase: { rpc: typeof mocks.rpc } };
const invite = inviteAgencyAdmin as unknown as (input: { data: { email: string }; context: Context }) => Promise<{ invited: boolean; alreadyAdmin: boolean }>;
const list = listAgencyAdmins as unknown as (input: { context: Context }) => Promise<unknown[]>;
const context = { userId: "agency-user", supabase: { rpc: mocks.rpc } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mocks.invite.mockResolvedValue({ data: { user: { id: "new-admin" } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.rows = [];
});
describe("Administrateurs agence", () => {
  it.each([false, null])("refuse l'ajout sans rôle agence (%s)", async (role) => {
    mocks.rpc.mockResolvedValue({ data: role, error: null });
    await expect(invite({ context, data: { email: "new@example.test" } })).rejects.toThrow("Réservé");
    expect(mocks.listUsers).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("refuse la liste aux comptes non agence", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(list({ context })).rejects.toThrow("Réservé");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("invite un nouveau compte et accorde uniquement admin", async () => {
    expect(await invite({ context, data: { email: "new@example.test" } })).toEqual({ invited: true, alreadyAdmin: false });
    expect(mocks.invite).toHaveBeenCalledWith("new@example.test", { redirectTo: "https://restaurant.lcdigitale.fr/reset-password" });
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "new-admin", role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    expect(mocks.rpc).toHaveBeenCalledWith("has_role", { _user_id: "agency-user", _role: "admin" });
  });
  it("ajoute un compte existant sans réinvitation", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "existing", email: "EXISTING@example.test" }] }, error: null });
    expect(await invite({ context, data: { email: "existing@example.test" } })).toEqual({ invited: false, alreadyAdmin: false });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.upsert.mock.calls[0]?.[0]).toEqual({ user_id: "existing", role: "admin" });
  });
  it("ne duplique pas un administrateur", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "existing", email: "existing@example.test" }] }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "role-id" }, error: null });
    expect(await invite({ context, data: { email: "existing@example.test" } })).toEqual({ invited: false, alreadyAdmin: true });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("n'accorde aucun droit après échec d'invitation", async () => {
    mocks.invite.mockResolvedValue({ data: { user: null }, error: { message: "failed" } });
    await expect(invite({ context, data: { email: "new@example.test" } })).rejects.toThrow("Invitation non envoyée");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("cherche aussi les comptes au-delà de la première page", async () => {
    mocks.listUsers.mockResolvedValueOnce({ data: { users: Array.from({ length: 100 }, (_, id) => ({ id: String(id), email: `user${id}@example.test` })) }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: "existing", email: "existing@example.test" }] }, error: null });
    await invite({ context, data: { email: "existing@example.test" } });
    expect(mocks.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 100 });
    expect(mocks.invite).not.toHaveBeenCalled();
  });
});