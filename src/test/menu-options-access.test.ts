import { describe, expect, it, vi } from "vitest";
import { loadOptionData } from "@/lib/menu-options";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Restaurant-scoped public menu options", () => {
  it("requests exactly one restaurant without direct table reads or active filtering", async () => {
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
});