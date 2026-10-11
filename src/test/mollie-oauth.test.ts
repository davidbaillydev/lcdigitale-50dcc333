import { describe, it, expect, vi, beforeEach } from "vitest";

// Base en mémoire remplaçant le client admin
type Row = { restaurant_id: string; provider: string; enabled: boolean; credentials: Record<string, string>; settings: Record<string, string> };
const db: { rows: Row[]; restaurants: { id: string; slug: string }[] } = { rows: [], restaurants: [] };

function table(name: string) {
  const filters: Record<string, unknown> = {};
  let patch: Record<string, unknown> | null = null;
  const match = (r: Record<string, unknown>) => Object.entries(filters).every(([k, v]) => r[k] === v);
  const src = () => (name === "restaurants" ? db.restaurants : db.rows) as unknown as Record<string, unknown>[];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters[k] = v; return q; },
    maybeSingle: async () => {
      if (patch) return { data: null };
      return { data: src().find(match) ?? null };
    },
    update: (p: Record<string, unknown>) => { patch = p; return q; },
    upsert: async (r: Row) => {
      const i = db.rows.findIndex((x) => x.restaurant_id === r.restaurant_id && x.provider === r.provider);
      if (i >= 0) db.rows[i] = r; else db.rows.push(r);
      return { error: null };
    },
    then: (res: (v: unknown) => void) => {
      if (patch) src().filter(match).forEach((r) => Object.assign(r, patch));
      res({ error: null });
    },
  };
  return q;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (n: string) => table(n) } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => {
  const b = { middleware: () => b, inputValidator: () => b, handler: (h: unknown) => h };
  return { createServerFn: () => b };
});

const R = "11111111-1111-1111-1111-111111111111";
const fetchMock = vi.fn();
beforeEach(() => {
  db.rows = []; db.restaurants = [{ id: R, slug: "woknsushi" }];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env["MOLLIE_CLIENT_ID"] = "app_test";
  process.env["MOLLIE_CLIENT_SECRET"] = "secret_test";
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function makeState(payload: Record<string, unknown>) {
  const { createHmac } = await import("crypto");
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${createHmac("sha256", "secret_test").update(b64).digest("base64url")}`;
}

describe("Mollie Connect", () => {
  it("calcule la commission de 7 %", async () => {
    const { mollieApplicationFee } = await import("@/lib/payments.functions");
    expect(mollieApplicationFee(5000)).toBe(3.5);
    expect(mollieApplicationFee(1999)).toBe(1.4);
  });

  it("vérifie le state signé et refuse un state falsifié ou expiré", async () => {
    const { verifyMollieState } = await import("@/lib/payments.functions");
    const ok = await makeState({ r: R, u: "u1", o: "https://restaurant.lcdigitale.fr", e: Date.now() + 60_000 });
    expect((await verifyMollieState(ok))?.r).toBe(R);
    expect(await verifyMollieState(ok.slice(0, -2) + "xx")).toBeNull();
    expect(await verifyMollieState(await makeState({ r: R, u: "u1", o: "x", e: Date.now() - 1 }))).toBeNull();
  });

  it("callback : échange le code, enregistre jetons + profil et redirige", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "access_1", refresh_token: "refresh_1", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ _embedded: { profiles: [{ id: "pfl_abc", name: "Wok & Sushi" }] } }))
      .mockResolvedValueOnce(json({ name: "Wok SAS" }));
    const { Route } = await import("@/routes/api/public/mollie-oauth-callback");
    const state = await makeState({ r: R, u: "u1", o: "https://restaurant.lcdigitale.fr", e: Date.now() + 60_000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GET = (Route.options as any).server.handlers.GET;
    const res: Response = await GET({ request: new Request(`https://restaurant.lcdigitale.fr/api/public/mollie-oauth-callback?code=auth_x&state=${encodeURIComponent(state)}`) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://restaurant.lcdigitale.fr/admin/woknsushi?mollie=connecte");
    const tokenCall = fetchMock.mock.calls[0]!;
    expect(tokenCall[0]).toBe("https://api.mollie.com/oauth2/tokens");
    expect(String(tokenCall[1].body)).toContain("grant_type=authorization_code");
    expect(String(tokenCall[1].body)).toContain(encodeURIComponent("https://restaurant.lcdigitale.fr/api/public/mollie-oauth-callback"));
    const row = db.rows[0]!;
    expect(row.enabled).toBe(true);
    expect(row.credentials["oauthRefreshToken"]).toBe("refresh_1");
    expect(row.credentials["profileId"]).toBe("pfl_abc");
    expect(row.settings["oauthOrg"]).toBe("Wok SAS");
  });

  it("callback : refuse un state invalide sans appeler Mollie", async () => {
    const { Route } = await import("@/routes/api/public/mollie-oauth-callback");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GET = (Route.options as any).server.handlers.GET;
    const res: Response = await GET({ request: new Request("https://x/api/public/mollie-oauth-callback?code=a&state=bad.sig") });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renouvelle automatiquement un jeton expiré", async () => {
    db.rows.push({ restaurant_id: R, provider: "mollie", enabled: true, settings: {},
      credentials: { mode: "live", oauthAccessToken: "old", oauthRefreshToken: "refresh_1", oauthExpiresAt: String(Date.now() - 1000) } });
    fetchMock.mockResolvedValueOnce(json({ access_token: "access_2", refresh_token: "refresh_2", expires_in: 3600 }));
    const { mollieForRestaurant } = await import("@/lib/payments.functions");
    const m = await mollieForRestaurant(R);
    expect(m).toMatchObject({ key: "access_2", oauth: true, live: true });
    expect(String(fetchMock.mock.calls[0]![1].body)).toContain("grant_type=refresh_token");
    expect(db.rows[0]!.credentials["oauthRefreshToken"]).toBe("refresh_2");
  });

  it("garde un jeton encore valide sans appel réseau", async () => {
    db.rows.push({ restaurant_id: R, provider: "mollie", enabled: true, settings: {},
      credentials: { mode: "live", oauthAccessToken: "fresh", oauthRefreshToken: "r", oauthExpiresAt: String(Date.now() + 3_600_000) } });
    const { mollieForRestaurant } = await import("@/lib/payments.functions");
    expect((await mollieForRestaurant(R))?.key).toBe("fresh");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
