import { beforeEach, describe, expect, it, vi } from "vitest";
import { exactRestaurantConfirmation } from "@/lib/restaurant-deletion";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
import { deleteAgencyRestaurant } from "@/lib/restaurant-deletion.functions";
const context = { userId: "agency", supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) } };
const remove = deleteAgencyRestaurant as unknown as (input: { context: typeof context; data: { id: string; confirmation: string } }) => Promise<unknown>;
const id = "00000000-0000-4000-8000-00000000cb01";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.single.mockResolvedValue({ data: { name: "TEST ADMIN CB — Vérification" }, error: null });
});
describe("Suppression sécurisée restaurant", () => {
  it("exige le nom exact, sans tolérer une différence de casse ou un espace", () => {
    const name = "TEST Intégrité Caisse";
    expect(exactRestaurantConfirmation(name, name)).toBe(true);
    for (const wrong of ["", "SUPPRIMER", "TEST", name.toLowerCase(), `${name} `]) expect(exactRestaurantConfirmation(name, wrong)).toBe(false);
  });
  it.each([false, null])("refuse sans administrateur agence (%s)", async (role) => {
    mocks.rpc.mockResolvedValue({ data: role, error: null });
    await expect(remove({ context, data: { id, confirmation: "TEST ADMIN CB — Vérification" } })).rejects.toThrow("administrateur agence");
    expect(mocks.single).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("refuse une erreur de vérification du rôle même avec un résultat positif", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: { message: "network" } });
    await expect(remove({ context, data: { id, confirmation: "TEST ADMIN CB — Vérification" } })).rejects.toThrow("administrateur agence");
    expect(mocks.single).not.toHaveBeenCalled();
  });
  it("vérifie le nom sauvegardé côté serveur", async () => {
    await expect(remove({ context, data: { id, confirmation: "SUPPRIMER" } })).rejects.toThrow("nom exact");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("transmet uniquement le restaurant confirmé à la suppression atomique", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: { ok: true, deletedOrders: 1 }, error: null });
    expect(await remove({ context, data: { id, confirmation: "TEST ADMIN CB — Vérification" } })).toEqual({ ok: true, deletedOrders: 1 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("delete_agency_restaurant", { _id: id, _confirmation: "TEST ADMIN CB — Vérification" });
  });
  it("remonte le blocage de conservation fiscale sans annoncer de suppression", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: { message: "Historique fiscal à conserver" } });
    await expect(remove({ context, data: { id, confirmation: "TEST ADMIN CB — Vérification" } })).rejects.toThrow("Historique fiscal");
  });
});