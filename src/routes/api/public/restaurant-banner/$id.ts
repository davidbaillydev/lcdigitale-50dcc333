import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const Route = createFileRoute("/api/public/restaurant-banner/$id")({
  server: { handlers: { GET: async ({ params, request }) => {
    const wantVideo = new URL(request.url).searchParams.get("kind") === "video";
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
    const path = wantVideo ? data?.brand?.bannerVideoPath : data?.brand?.bannerPath;
    const pattern = wantVideo ? /^[a-f0-9-]+\/[a-f0-9-]+\.(mp4|webm)$/ : /^[a-f0-9-]+\/[a-f0-9-]+\.jpg$/;
    if (typeof path !== "string" || !path.startsWith(`${params.id}/`) || !pattern.test(path)) return new Response("Not found", { status: 404 });
    const type = wantVideo ? (path.endsWith(".mp4") ? "video/mp4" : "video/webm") : "image/jpeg";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from("restaurant-banners").download(path);
    if (error || !file) return new Response("Not found", { status: 404 });
    const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": wantVideo ? "public, max-age=31536000, immutable" : "public, max-age=60", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
    // Safari exige les requêtes partielles (Range) pour lire une vidéo.
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (wantVideo && range && (range[1] || range[2])) {
      const size = file.size;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new Response(file.slice(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(file, { headers });
  } } },
});