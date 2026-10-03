import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const Route = createFileRoute("/api/public/restaurant-banner/$id")({
  server: { handlers: { GET: async ({ params }) => {
    if (!z.string().uuid().safeParse(params.id).success) return new Response("Not found", { status: 404 });
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data } = await client.from("restaurants").select("brand").eq("id", params.id).eq("active", true).maybeSingle();
    const path = data?.brand?.bannerPath;
    if (typeof path !== "string" || !path.startsWith(`${params.id}/`) || !/^[a-f0-9-]+\/[a-f0-9-]+\.jpg$/.test(path)) return new Response("Not found", { status: 404 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from("restaurant-banners").download(path);
    if (error || !file) return new Response("Not found", { status: 404 });
    return new Response(file, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
  } } },
});