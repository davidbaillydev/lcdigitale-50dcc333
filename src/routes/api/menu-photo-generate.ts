import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateGoogleImage, generateImage, imageSettings, imageSse } from "@/lib/image-gateway.server";
import { GeminiUnavailable } from "@/lib/menu-gemini.server";

const body = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  desc: z.string().max(500).optional(),
  stream: z.boolean().optional(),
  kind: z.enum(["dish", "cover"]).optional(),
});

/** Création IA de la photo d'un plat ou de la couverture d'un restaurant (gérant ou agence). */
export const Route = createFileRoute("/api/menu-photo-generate")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) return new Response("Connexion requise", { status: 401 });
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response("Demande invalide", { status: 400 });
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
        const h = new Headers(init?.headers); h.set("apikey", key); return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: claims } = await client.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return new Response("Connexion requise", { status: 401 });
    const { data: ok } = await client.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: parsed.data.restaurantId });
    if (!ok) return new Response("Réservé au gérant ou à l'agence", { status: 403 });
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return new Response("Création d'image indisponible", { status: 500 });
    const { name, desc, stream = true, kind = "dish" } = parsed.data;
    const prompt = kind === "cover"
      ? `Inviting professional cover photograph for the restaurant "${name}"${desc ? `. Context: ${desc}` : ""}. Showcase its signature food and atmosphere, appetizing, realistic, warm natural light, landscape composition suited to a directory thumbnail, no text, no logo, no watermark.`
      : `Professional appetizing food photograph of the restaurant dish "${name}"${desc ? `, described as: ${desc}` : ""}. Served on a plate, realistic, natural soft light, shallow depth of field, 3/4 overhead angle, clean neutral background, no text, no logo, no people.`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: google } = await supabaseAdmin.from("agency_menu_ai_credentials").select("api_key").eq("id", "gemini").maybeSingle();
    if (google?.api_key) {
      try {
        return imageSse(await generateGoogleImage(google.api_key, prompt));
      } catch (error) {
        if (!(error instanceof GeminiUnavailable)) {
          const message = error instanceof Error ? error.message : "Création Google impossible";
          return new Response(message, { status: /refusé/.test(message) ? 400 : 502 });
        }
        await supabaseAdmin.from("agency_menu_ai_credentials").update({
          last_fallback_reason: error.message,
          last_fallback_at: new Date().toISOString(),
        }).eq("id", "gemini");
      }
    }
    const upstream = await generateImage({ ...imageSettings, apiKey }, prompt, stream);
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache",
    } });
  } } },
});
