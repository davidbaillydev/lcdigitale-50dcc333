import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (d: unknown) => d;
  const builder = { middleware: () => builder, inputValidator: (fn: typeof validate) => { validate = fn; return builder; }, handler: (fn: (args: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data), context: { supabase: mocks, userId: "agency-user" } }) };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { getOrdersAvailabilityHistory, toggleOrdersPaused } from "@/lib/restaurant-settings.functions";
type Call = (args: { data: unknown }) => Promise<unknown>;
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => vi.clearAllMocks());
describe("audit des commandes", () => {
  it("refuse les suspensions d’un autre restaurant avant toute écriture", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    await expect((toggleOrdersPaused as unknown as Call)({ data: { restaurantId: id, paused: true } })).rejects.toThrow("Accès refusé");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("transmet la suspension par la session authentifiée sans e-mail fourni par le navigateur", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: { ordersResumeAt: "2026-11-14T17:00:00Z" } });
    expect(await (toggleOrdersPaused as unknown as Call)({ data: { restaurantId: id, paused: true, email: "fake@example.org" } })).toEqual({ paused: true, resumeAt: "2026-11-14T17:00:00Z" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_orders_paused", { _restaurant_id: id, _paused: true });
  });
  it("refuse la lecture de l’historique sans accès au restaurant", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    await expect((getOrdersAvailabilityHistory as unknown as Call)({ data: { restaurantId: id } })).rejects.toThrow("Accès refusé");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("borne la lecture au restaurant demandé avec date, e-mail et action", async () => {
    mocks.rpc.mockResolvedValue({ data: true });
    const record = { id: "event", action: "suspended", actor_email: "staff@example.org", occurred_at: "2026-11-14T12:00:00Z", resume_at: "2026-11-14T17:00:00Z" };
    const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [record] }) };
    mocks.from.mockReturnValue(q);
    expect(await (getOrdersAvailabilityHistory as unknown as Call)({ data: { restaurantId: id } })).toEqual([record]);
    expect(q.eq).toHaveBeenCalledWith("restaurant_id", id);
    expect(q.select).toHaveBeenCalledWith("id, action, actor_email, occurred_at, resume_at");
  });
});
// Execute these SQL assertions against the applied database as well as keeping
// them here: the database owns time-zone conversion and the transition audit.
export const serviceAssertions = [
  { name: "prochain service du même jour", opening: { 6: [[660, 840], [1080, 1380]] }, now: "2026-11-14T12:00:00Z", expected: "2026-11-14T17:00:00Z" },
  { name: "jour fermé ignoré", opening: { 1: [[660, 840]] }, now: "2026-11-14T22:00:00Z", expected: "2026-11-16T10:00:00Z" },
  { name: "lendemain sans horaires", opening: {}, now: "2026-11-14T12:00:00Z", expected: "2026-11-14T23:00:00Z" },
  { name: "changement d’heure Paris", opening: { 0: [[660, 840]] }, now: "2026-03-28T12:00:00Z", expected: "2026-03-29T09:00:00Z" },
];
describe("définition du journal immuable", () => {
  const sql = readFileSync("drizzle/migrations/0047_orders_pause_audit_resume.sql", "utf8");
  it("réserve aux équipes la lecture seule", () => {
    expect(sql).toContain("GRANT SELECT ON public.restaurant_order_availability_audit TO authenticated");
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
describe("horaires réels en base", () => {
  it.each(serviceAssertions)("$name", ({ opening, now, expected }) => {
    const query = `SELECT public.next_order_service('${JSON.stringify(opening)}'::jsonb,'${now}') = '${expected}'::timestamptz AS passed`;
    const result = JSON.parse(execFileSync("lovable", ["supabase", "query", query], { encoding: "utf8" }));
    expect(result[0].passed).toBe(true);
  }, 20000);
  it("réactive une suspension échue sans toucher aux autres réglages et journalise le système", () => {
    const query = `SELECT pg_get_functiondef('public.resume_due_order_availability()'::regprocedure) AS resume, pg_get_functiondef('public.audit_order_availability()'::regprocedure) AS audit`;
    const result = JSON.parse(execFileSync("lovable", ["supabase", "query", query], { encoding: "utf8" }));
    expect(result[0].resume).toContain("jsonb_set(config,'{ordersPaused}','false'::jsonb)");
    expect(result[0].resume).toContain("(config->>'ordersResumeAt')::timestamptz <= now()");
    expect(result[0].audit).toContain("NEW.config := NEW.config - 'ordersResumeAt'");
    expect(result[0].audit).toContain("WHEN automatic THEN 'auto_resumed'");
    expect(result[0].audit).toContain("SELECT u.email INTO email FROM auth.users u WHERE u.id = actor");
  }, 20000);
});