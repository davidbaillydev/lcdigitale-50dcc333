import { describe, expect, it, vi } from "vitest";
import { loadOptionData } from "@/lib/menu-options";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

describe("Restaurant-scoped public menu options", () => {
  it("requests exactly one restaurant with access filtering delegated to the database", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { variants: [], groups: [], items: [{ id: "extra", group_id: "group", name: "Sauce", price: "2.50", is_available: true, sort_order: 1 }], links: [] }, error: null });
    const from = vi.fn(() => { throw new Error("Direct public reads forbidden"); });
    const client = { rpc, from } as unknown as SupabaseClient;
    const result = await loadOptionData(client, "6d5cead0-fdb2-44a9-8dde-5c1f9b28187d");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_restaurant_menu_options", { _restaurant_id: "6d5cead0-fdb2-44a9-8dde-5c1f9b28187d" });
    expect(from).not.toHaveBeenCalled();
    expect(result.items[0]?.price).toBe(2.5);
  });
  it("does not silently hide a failed options read", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }) } as unknown as SupabaseClient;
    await expect(loadOptionData(client, "restaurant")).rejects.toThrow("Lecture des options impossible");
  });
  it("returns empty options when the database denies visibility", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { variants: [], groups: [], items: [], links: [] }, error: null }) } as unknown as SupabaseClient;
    await expect(loadOptionData(client, "inactive-restaurant")).resolves.toEqual({ variants: [], groups: [], items: [], links: [] });
  });
  it("makes the menu function follow caller access instead of bypassing protection", () => {
    const sql = readFileSync("drizzle/migrations/0056_enforce_menu_option_caller_access.sql", "utf8");
    expect(sql).toContain("ALTER FUNCTION public.read_restaurant_menu_options(uuid) SECURITY INVOKER;");
    expect(sql).toContain("SET search_path = public;");
    expect(sql).toContain("FROM PUBLIC;");
    for (const table of ["product_variants", "option_groups", "option_items", "product_option_groups"]) {
      expect(sql).toContain(`ON public.${table} FOR SELECT TO anon, authenticated`);
      expect(sql).toContain(`r.id = ${table}.restaurant_id AND r.active`);
    }
    expect(sql).not.toMatch(/FOR (?:ALL|INSERT|UPDATE|DELETE)/);
  });
});