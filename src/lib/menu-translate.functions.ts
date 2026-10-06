import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tr = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional() });
const out = z.object({
  items: z.array(z.object({ id: z.string(), en: tr, es: tr, de: tr })),
  categories: z.array(z.object({ id: z.string(), en: z.string().max(80), es: z.string().max(80), de: z.string().max(80) })),
});
export type PretranslateResult = z.infer<typeof out>;

/** Pré-traduction ponctuelle (EN/ES/DE) par le gérant ; le résultat est enregistré avec la carte, jamais recalculé à l'affichage. */
export const pretranslateMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    items: z.array(z.object({ id: z.string().max(80), name: z.string().max(120), desc: z.string().max(500).optional() })).max(150),
    categories: z.array(z.object({ id: z.string().max(80), label: z.string().max(80) })).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    if (!data.items.length && !data.categories.length) return { items: [], categories: [] } as PretranslateResult;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Traduction momentanément indisponible");
    const prompt = `Traduis cette carte de restaurant du français vers l'anglais (en), l'espagnol (es) et l'allemand (de). Garde tels quels les noms propres de plats (ex. "Maki", "Pad Thaï") quand c'est l'usage. Réponds UNIQUEMENT en JSON : {"items":[{"id":"...","en":{"name":"...","description":"..."},"es":{...},"de":{...}}],"categories":[{"id":"...","en":"...","es":"...","de":"..."}]}. Omets "description" si le plat n'en a pas.\n${JSON.stringify({ items: data.items, categories: data.categories })}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
    });
    if (res.status === 429) throw new Error("Trop de demandes, réessayez dans un instant");
    if (res.status === 402) throw new Error("Crédits IA épuisés");
    if (!res.ok) throw new Error("Traduction impossible, réessayez");
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("Réponse de traduction illisible, réessayez"); }
    const r = out.safeParse(parsed);
    if (!r.success) throw new Error("Traduction incomplète, réessayez");
    return r.data;
  });
