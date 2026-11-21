import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { setupKioskChoices } from "./kiosk-device";
import { featuresOf } from "./features";

/** Minimal public setup list; PIN hashes and payment reader identifiers never leave the server. */
export const listKioskSetupRestaurants = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Impossible de charger les restaurants.");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.from("restaurants").select("id,slug,name,city,logo_url,config,enabled_features")
    .eq("active", true).order("name");
  if (error) throw new Error("Impossible de charger les restaurants.");
  return (data ?? []).filter((r) => featuresOf(r.enabled_features).borne).map((r) => ({
    id: r.id, slug: r.slug, name: r.name, city: r.city, logo: r.logo_url, kiosks: setupKioskChoices(r.config),
  }));
});