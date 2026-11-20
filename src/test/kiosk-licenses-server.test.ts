import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), upsert: vi.fn(), single: vi.fn(), eq: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (h: unknown) => h }; return builder;
} }));
import { getKioskAudit, getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense, registerLicensedKiosk, setLicensedKioskActive } from "@/lib/kiosk-licenses.functions";
const context = { userId: "agency", supabase: { rpc: mocks.rpc, from: mocks.from } };
type Handler = (arg: { context: typeof context; data?: unknown }) => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null });
  const q = { select: () => q, eq: mocks.eq, order: () => q, range: mocks.range, single: mocks.single, upsert: mocks.upsert };
  mocks.eq.mockReturnValue(q);
  mocks.range.mockResolvedValue({ data: [{ id: "audit", active: false, actor_email: "agency@example.test" }], count: 21, error: null });
  mocks.from.mockReturnValue(q); mocks.upsert.mockReturnValue(q);
  mocks.single.mockResolvedValue({ data: { id: "license" }, error: null });
});
describe("licences agence serveur", () => {
  it.each([getKioskAudit, getKioskLicenses, prepareKioskBilling, saveKioskBilling, saveKioskLicense, registerLicensedKiosk, setLicensedKioskActive])("refuse tout accès non agence", async (fn) => {
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
  it("suspend uniquement la borne demandée via la commande atomique", async () => {
    await (setLicensedKioskActive as unknown as Handler)({ context, data: { restaurantId: "restaurant", kioskId: "2", active: false } });
    expect(mocks.rpc).toHaveBeenLastCalledWith("agency_set_kiosk_active", { _restaurant: "restaurant", _kiosk: "2", _active: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("crée borne et licence sans lecteur ni prix fourni par le client", async () => {
    await (registerLicensedKiosk as unknown as Handler)({ context, data: { restaurantId: "restaurant", kioskId: "3", label: "Entrée", startsOn: "2026-11-20", amount: 1, reader: "" } });
    expect(mocks.rpc).toHaveBeenLastCalledWith("agency_register_kiosk", { _restaurant: "restaurant", _kiosk: "3", _label: "Entrée", _starts: "2026-11-20" });
  });
  it("filtre le journal par restaurant et lit 20 événements par page", async () => {
    const result = await (getKioskAudit as unknown as Handler)({ context, data: { restaurantId: "restaurant", page: 1 } });
    expect(mocks.from).toHaveBeenCalledWith("kiosk_activation_audit");
    expect(mocks.eq).toHaveBeenCalledWith("restaurant_id", "restaurant");
    expect(mocks.range).toHaveBeenCalledWith(20, 39);
    expect(result).toEqual({ rows: [{ id: "audit", active: false, actor_email: "agency@example.test" }], total: 21 });
  });
  it("ne présente pas un journal vide si sa lecture échoue", async () => {
    mocks.range.mockResolvedValue({ data: null, count: null, error: { message: "denied" } });
    await expect((getKioskAudit as unknown as Handler)({ context, data: { restaurantId: null, page: 0 } })).rejects.toThrow("Impossible de charger le journal");
  });
});