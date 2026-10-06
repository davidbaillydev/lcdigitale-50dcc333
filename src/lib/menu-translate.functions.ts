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
    const tObj = { type: "object", additionalProperties: false, required: ["name", "description"], properties: { name: { type: "string" }, description: { type: ["string", "null"] } } };
    const schema = { type: "object", additionalProperties: false, required: ["items", "categories"], properties: {
      items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "en", "es", "de"], properties: { id: { type: "string" }, en: tObj, es: tObj, de: tObj } } },
      categories: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "en", "es", "de"], properties: { id: { type: "string" }, en: { type: "string" }, es: { type: "string" }, de: { type: "string" } } } },
    } };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" }, input: [{ role: "user", content: prompt }], text: { format: { type: "json_schema", name: "menu_translations", strict: true, schema } } }),
    });
    if (res.status === 429) throw new Error("Trop de demandes, réessayez dans un instant");
    if (res.status === 402) throw new Error("Crédits IA épuisés");
    if (!res.ok || !res.body) throw new Error("Traduction impossible, réessayez");
    // Lecture du flux SSE : on concatène les fragments de texte.
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ""; let raw = "";
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try { const ev = JSON.parse(l.slice(5)); if (ev.type === "response.output_text.delta") raw += ev.delta ?? ""; } catch { /* ligne non JSON */ }
      }
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("Réponse de traduction illisible, réessayez"); }
    // Le schéma strict renvoie description: null quand le plat n'en a pas
    const clean = JSON.parse(JSON.stringify(parsed, (k, v) => (k === "description" && v === null ? undefined : v)));
    const r = out.safeParse(clean);
    if (!r.success) throw new Error("Traduction incomplète, réessayez");
    return r.data;
  });
