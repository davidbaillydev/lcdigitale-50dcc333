import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), upsert: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (h: unknown) => h }; return builder;
} }));
import { getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense } from "@/lib/kiosk-licenses.functions";
const context = { userId: "agency", supabase: { rpc: mocks.rpc, from: mocks.from } };
type Handler = (arg: { context: typeof context; data?: unknown }) => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null });
  const q = { select: () => q, eq: () => q, single: mocks.single, upsert: mocks.upsert };
  mocks.from.mockReturnValue(q); mocks.upsert.mockReturnValue(q);
  mocks.single.mockResolvedValue({ data: { id: "license" }, error: null });
});
describe("licences agence serveur", () => {
  it.each([getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense])("refuse tout accès non agence", async (fn) => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect((fn as unknown as Handler)({ context, data: {} })).rejects.toThrow("Réservé");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("calcule l'année côté serveur sans prendre de prix client", async () => {
    await (saveKioskLicense as unknown as Handler)({ context, data: { restaurantId: "restaurant", kioskId: "2", label: "Terrasse", status: "active", startsOn: "2026-11-03", notes: "", amount: 1 } });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ ends_on: "2027-11-03", kiosk_id: "2" }), { onConflict: "restaurant_id,kiosk_id" });
    expect(mocks.upsert.mock.calls[0]?.[0]).not.toHaveProperty("amount");
  });
  it("prépare 400 € HT et conserve les facturations déjà enregistrées", async () => {
    mocks.single.mockResolvedValue({ data: { id: "license", status: "active", starts_on: "2026-11-03", ends_on: "2027-11-03" }, error: null });
    const q = { error: null }; mocks.upsert.mockResolvedValue(q);
    await (prepareKioskBilling as unknown as Handler)({ context, data: { licenseId: "license", amount: 1 } });
    expect(mocks.upsert).toHaveBeenCalledWith({ license_id: "license", starts_on: "2026-11-03", ends_on: "2027-11-03", amount_ht_cents: 40000, updated_by: "agency" }, { onConflict: "license_id,starts_on,ends_on", ignoreDuplicates: true });
  });
});