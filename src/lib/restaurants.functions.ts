import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { RESTAURANT_COLUMNS, type Restaurant } from "./shop";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listRestaurants = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("restaurants").select(RESTAURANT_COLUMNS).eq("active", true).order("name");
  return (data ?? []) as unknown as Restaurant[];
});

/** Statut de réception des commandes, relu sans cache à chaque chargement. */
export const getOrderingStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await publicClient().from("restaurants").select("config").eq("slug", data.slug).eq("active", true).maybeSingle();
    return { paused: !row || (row.config as { ordersPaused?: boolean } | null)?.ordersPaused === true };
  });

export const getRestaurant = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await publicClient().from("restaurants").select(RESTAURANT_COLUMNS).eq("slug", data.slug).eq("active", true).maybeSingle();
    return (row ?? null) as unknown as Restaurant | null;
  });
