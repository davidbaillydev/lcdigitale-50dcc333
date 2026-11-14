import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const query = (sql: string) => JSON.parse(execFileSync("lovable", ["supabase", "query", sql], { encoding: "utf8" }));
describe("automatic resume manager notifications", () => {
  const definitions = () => query("SELECT pg_get_functiondef('public.notify_automatic_order_resume()'::regprocedure) AS notify, pg_get_functiondef('public.consume_availability_notifications()'::regprocedure) AS consume")[0];
  it("only automatic resumes enqueue notifications", () => {
    expect(definitions().notify).toContain("IF NEW.action <> 'auto_resumed' THEN RETURN NEW");
  });
  it("targets restaurant managers and agency admins, deduplicated per event", () => {
    const sql = definitions().notify;
    expect(sql).toContain("m.restaurant_id=NEW.restaurant_id AND m.role='manager'");
    expect(sql).toContain("u.role='admin'");
    expect(sql).toContain("ON CONFLICT(audit_id,user_id) DO NOTHING");
  });
  it("rechecks current manager access and claims only this recipient’s unread notifications", () => {
    const sql = definitions().consume;
    expect(sql).toContain("n.user_id=auth.uid() AND n.read_at IS NULL AND public.is_restaurant_manager(auth.uid(),n.restaurant_id)");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("SET read_at=now()");
  });
  it("allows authenticated read only with own-recipient and manager checks", () => {
    const result = query("SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_availability_notifications'");
    expect(result).toHaveLength(1);
    expect(result[0].qual).toContain("user_id = auth.uid()");
    expect(result[0].qual).toContain("is_restaurant_manager(auth.uid(), restaurant_id)");
    const grants = query("SELECT has_table_privilege('authenticated','public.restaurant_availability_notifications','SELECT') AS can_read, has_table_privilege('authenticated','public.restaurant_availability_notifications','UPDATE') AS can_update, has_table_privilege('anon','public.restaurant_availability_notifications','SELECT') AS anon_read")[0];
    expect(grants).toEqual({ can_read: true, can_update: false, anon_read: false });
  });
});