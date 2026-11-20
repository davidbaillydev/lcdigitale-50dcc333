import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn(), assertManager: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (h: unknown) => h }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/payments/shared", () => ({ admin: mocks.admin, assertManager: mocks.assertManager, assertOrdersOpen: vi.fn(), getRow: vi.fn() }));
import { setKioskReaders } from "@/lib/payments/terminal";
const context = { userId: "agency-user", supabase: { rpc: mocks.rpc } };
const call = setKioskReaders as unknown as (arg: { context: typeof context; data: { restaurantId: string; kiosks: { id: string; label: string; reader: string; active: boolean }[] } }) => Promise<unknown>;
beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); });
describe("attribution des réglages borne", () => {
  it("utilise le client authentifié pour que le journal conserve le responsable", async () => {
    const kiosks = [{ id: "2", label: "Entrée", reader: "", active: false }];
    await call({ context, data: { restaurantId: "restaurant", kiosks } });
    expect(mocks.rpc).toHaveBeenCalledWith("agency_save_kiosk_readers", { _restaurant: "restaurant", _kiosks: kiosks });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("ne change rien quand le rôle agence est refusé", async () => {
    mocks.assertManager.mockRejectedValue(new Error("Réservé à l’agence"));
    await expect(call({ context, data: { restaurantId: "restaurant", kiosks: [] } })).rejects.toThrow("Réservé");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});