import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

const body = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  desc: z.string().max(500).optional(),
  stream: z.boolean().optional(),
});

/** Création IA de la photo d'un plat d'après son nom et sa description (gérant ou agence). */
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
    const { name, desc, stream = true } = parsed.data;
    const prompt = `Professional appetizing food photograph of the restaurant dish "${name}"${desc ? `, described as: ${desc}` : ""}. Served on a plate, realistic, natural soft light, shallow depth of field, 3/4 overhead angle, clean neutral background, no text, no logo, no people.`;
    const upstream = await generateImage({ ...imageSettings, apiKey }, prompt, stream);
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache",
    } });
  } } },
});
