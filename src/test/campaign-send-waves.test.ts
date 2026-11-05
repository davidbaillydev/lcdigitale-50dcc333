import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), fetch: vi.fn(), updates: vi.fn(), audit: vi.fn(), claimed: true, consentRows: [] as { id: string; email: string; name: null }[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (h: (d: unknown) => unknown) => async (args: { data: unknown; context: unknown }) => h({ ...args, data: validate(args.data) }) };
  return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/campaign.server", () => ({ campaignHtml: () => "fixture", unsubToken: () => "fixture" }));
import { sendCampaign } from "@/lib/campaign.functions";

const id = "00000000-0000-4000-8000-000000000001";
const clients = Array.from({ length: 650 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`, email: `c${i}@example.com`, name: null }));
const data = { restaurantId: id, campaignId: id, customerIds: clients.map((c) => c.id), subject: "Offre novembre", body: "Message promotion", ctaUrl: "", ctaLabel: "Commander", origin: "https://example.com", waveSize: 100 };
const payload = { subject: data.subject, body: data.body, ctaUrl: "", ctaLabel: "Commander", origin: data.origin };
let campaign: { id: string; payload: typeof payload; remaining_ids: string[]; sent_emails: string[]; sent: number; state: string };
const context = { supabase: { rpc: mocks.rpc }, userId: id };
const invoke = sendCampaign as unknown as (args: { data: unknown; context: typeof context }) => Promise<{ sent: number; remaining: number }>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BREVO_API_KEY", "fixture"); vi.stubEnv("LOVABLE_API_KEY", "fixture");
  vi.stubGlobal("fetch", mocks.fetch); mocks.fetch.mockResolvedValue({ ok: true });
  mocks.rpc.mockResolvedValue({ data: true }); mocks.claimed = true; mocks.consentRows = clients;
  campaign = { id, payload, remaining_ids: clients.map((c) => c.id), sent_emails: [], sent: 0, state: "idle" };
  mocks.from.mockImplementation((table: string) => {
    let patch: Record<string, unknown> | undefined;
    let queriedIds: string[] = [];
    const q = {
      select: () => q, eq: () => q, not: () => q,
      in: (_key: string, values: string[]) => { queriedIds = values; return q; },
      upsert: async () => ({ error: null }),
      update: (value: Record<string, unknown>) => { patch = value; mocks.updates(value); return q; },
      insert: mocks.audit.mockResolvedValue({ error: null }),
      single: async () => ({ data: table === "restaurants" ? { name: "Fixture", brand: {} } : { ...campaign }, error: null }),
      maybeSingle: async () => ({ data: mocks.claimed ? { id } : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        if (patch) Object.assign(campaign, patch);
        return Promise.resolve({ data: table === "restaurant_customers" ? mocks.consentRows.filter((c) => queriedIds.includes(c.id)) : null, error: null }).then(resolve);
      },
    }; return q;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Authenticated campaign send handler", () => {
  it("sends one wave of 100, persists progress, then sends different recipients", async () => {
    expect(await invoke({ data, context })).toMatchObject({ sent: 100, remaining: 550 });
    expect(campaign.sent).toBe(100);
    expect(campaign.state).toBe("idle");
    const first = JSON.parse(mocks.fetch.mock.calls[0]?.[1]?.body ?? "{}").messageVersions;
    expect(first).toHaveLength(100);
    await invoke({ data, context });
    const next = JSON.parse(mocks.fetch.mock.calls[1]?.[1]?.body ?? "{}").messageVersions;
    expect(next[0].to[0].email).toBe("c100@example.com");
    expect(campaign.sent).toBe(200);
  });
  it("rejects more than 300 before any delivery", async () => {
    await expect(invoke({ data: { ...data, waveSize: 301 }, context })).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects non-agency users before touching recipients", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    await expect(invoke({ data, context })).rejects.toThrow("Réservé");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not send when another request has claimed the wave", async () => {
    mocks.claimed = false;
    await expect(invoke({ data, context })).rejects.toThrow("déjà en cours");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("blocks retries after an ambiguous provider failure", async () => {
    mocks.fetch.mockRejectedValue(new Error("Network interrupted"));
    await expect(invoke({ data, context })).rejects.toThrow("Vérifiez");
    expect(campaign.state).toBe("uncertain");
    expect(campaign.sent).toBe(0);
  });
  it("rechecks consent before delivering", async () => {
    mocks.consentRows = clients.slice(1);
    await invoke({ data, context });
    const versions = JSON.parse(mocks.fetch.mock.calls[0]?.[1]?.body ?? "{}").messageVersions;
    expect(versions[0].to[0].email).toBe("c1@example.com");
    expect(versions).toHaveLength(100);
  });
});