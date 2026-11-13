import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), fetch: vi.fn(), claim: true, consent: true, blacklist: false, failed: false, updates: [] as Record<string, unknown>[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const b = { middleware: () => b, inputValidator: (fn: typeof validate) => { validate = fn; return b; }, handler: (fn: (x: unknown) => unknown) => (args: { data: unknown; context: unknown }) => fn({ ...args, data: validate(args.data) }) };
  return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { sendSmsBatch } from "@/lib/sms-campaign.functions";
const id = "00000000-0000-4000-8000-000000000001";
const customer = { id, name: "Client", phone: "+33612345678", marketing_consent: true, consent_at: "2026-11-01T00:00:00Z" };
const campaign = { id, restaurant_id: id, remaining_ids: [id], sent_phones: [], sent: 0, skipped: 0, state: "idle", sender: "TacosHouse", content: "Offre\nReply STOP to [STOP_CODE]" };
const context = { userId: id, supabase: { rpc: mocks.rpc } };
const invoke = sendSmsBatch as unknown as (args: { data: unknown; context: typeof context }) => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.claim = true; mocks.consent = true; mocks.blacklist = false; mocks.failed = false; mocks.updates = [];
  vi.stubEnv("BREVO_API_KEY", "fixture"); vi.stubEnv("LOVABLE_API_KEY", "fixture"); vi.stubGlobal("fetch", mocks.fetch);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockImplementation(async (_url: string, opts: { method: string }) => opts.method === "GET" ? new Response(JSON.stringify({ smsBlacklisted: mocks.blacklist }), { status: 200 }) : mocks.failed ? new Response('provider down', { status: 503 }) : new Response(JSON.stringify({ messageId: 123 }), { status: 201 }));
  mocks.from.mockImplementation((table: string) => {
    let patch: Record<string, unknown> | null = null;
    const q = { select: () => q, eq: () => q, order: () => q, range: () => q, update: (p: Record<string, unknown>) => { patch = p; mocks.updates.push(p); return q; }, insert: () => q,
      single: async () => ({ data: table === "restaurant_sms_campaigns" ? campaign : table === "restaurants" ? { config: { country: "FR" } } : { id }, error: null }),
      maybeSingle: async () => ({ data: table === "restaurant_customers" ? { ...customer, marketing_consent: mocks.consent } : table === "restaurant_sms_campaigns" ? (mocks.claim ? { id } : null) : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "restaurant_sms_deliveries" && !patch ? [] : null, error: null }).then(resolve),
    }; return q;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("SMS send boundary", () => {
  it("denies non-agency accounts before accessing data or Brevo", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    await expect(invoke({ data: { campaignId: id }, context })).rejects.toThrow("agence");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("prevents concurrent or uncertain wave retry", async () => {
    mocks.claim = false;
    await expect(invoke({ data: { campaignId: id }, context })).rejects.toThrow("incertain");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rechecks consent and skips revoked clients", async () => {
    mocks.consent = false;
    expect(await invoke({ data: { campaignId: id }, context })).toMatchObject({ sent: 0, skipped: 1 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("respects Brevo SMS blacklist without resetting consent", async () => {
    mocks.blacklist = true;
    expect(await invoke({ data: { campaignId: id }, context })).toMatchObject({ sent: 0, skipped: 1 });
    expect(mocks.fetch.mock.calls.filter((c) => c[1].method === "POST")).toHaveLength(0);
  });
  it("submits marketing SMS with functional STOP, never transactional", async () => {
    expect(await invoke({ data: { campaignId: id }, context })).toMatchObject({ sent: 1, done: true });
    const post = mocks.fetch.mock.calls.find((c) => c[1].method === "POST");
    expect(JSON.parse(post?.[1].body ?? "{}")).toMatchObject({ type: "marketing", content: "Offre\nReply STOP to [STOP_CODE]", recipient: "+33612345678" });
    expect(mocks.updates.some((p) => p["state"] === "submitted" && p["message_id"] === "123")).toBe(true);
  });
  it("blocks ambiguous provider failures instead of resending automatically", async () => {
    mocks.failed = true;
    await expect(invoke({ data: { campaignId: id }, context })).rejects.toThrow("Reprise bloquée");
    expect(mocks.updates.some((p) => p["state"] === "uncertain")).toBe(true);
  });
  it("caps one server invocation at five recipients", async () => {
    expect(() => invoke({ data: { campaignId: id, limit: 6 }, context })).toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});