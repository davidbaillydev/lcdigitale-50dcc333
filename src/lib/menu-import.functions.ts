import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLERGEN_IDS, cleanAllergens } from "./allergens";

const request = z.object({
  restaurantId: z.string().uuid(),
  pages: z.array(z.object({ type: z.enum(["text", "image"]), content: z.string().max(8_000_000) })).min(1).max(8),
});

/** Analyse seulement : aucune écriture avant validation explicite de la carte. */
export const analyzeMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => request.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("is_restaurant_manager", {
      _user_id: context.userId, _restaurant_id: data.restaurantId,
    });
    if (accessError || !allowed) throw new Error("Accès réservé au gérant ou à l'agence");
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("L'analyse de carte est momentanément indisponible");
    const content = [
      { type: "input_text", text: `Extrais la carte de restaurant jointe. Réponds UNIQUEMENT avec un JSON valide de forme {\"categories\":[{\"label\":\"...\",\"items\":[{\"name\":\"...\",\"desc\":\"...\",\"price\":12.5,\"allergens\":[\"gluten\"]}]}]}. Reprends exclusivement les plats et prix clairement lisibles ; ne devine aucun prix, ne crée pas de plat. Ignore les lignes sans prix vérifiable. Prix en euros numériques, virgule décimale convertie en point. Regroupe sous des catégories appropriées. Les options ou suppléments incertains sont à vérifier humainement. Pour chaque plat, renseigne \"allergens\" avec les identifiants parmi ${ALLERGEN_IDS.join(", ")} : ceux indiqués sur la carte (pictogrammes, mentions) ET ceux évidents d'après les ingrédients cités (ex. sushi/maki → poissons, sésame, soja via sauce ; tempura/nouilles de blé → gluten ; crevette → crustacés). Tableau vide si rien d'identifiable.` },
      ...data.pages.map((p) => p.type === "image"
        ? { type: "input_image", image_url: p.content }
        : { type: "input_text", text: p.content }),
    ];
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", input: [{ role: "user", content }] }),
    });
    if (!response.ok) throw new Error(response.status === 429 ? "Trop de demandes, réessayez plus tard" : "Analyse impossible, réessayez avec un fichier plus net");
    const result = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] };
    const raw = result.output?.flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("") ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); }
    catch { throw new Error("La carte n'a pas pu être reconnue. Essayez un document plus lisible."); }
    const schema = z.object({ categories: z.array(z.object({ label: z.string().trim().min(1).max(80), items: z.array(z.object({ name: z.string().trim().min(1).max(120), desc: z.string().max(500).optional(), price: z.number().finite().min(0).max(1000), allergens: z.array(z.string()).max(30).optional() })).max(300) })).max(60) });
    const menu = schema.safeParse(parsed);
    if (!menu.success || !menu.data.categories.some((c) => c.items.length)) throw new Error("Aucun plat avec prix lisible n'a été trouvé.");
    return menu.data.categories.map((c, ci) => ({
      id: `import-${ci}`, label: c.label,
      items: c.items.map((i, ii) => ({ id: `import-${ci}-${ii}`, name: i.name, price: i.price, ...(i.desc ? { desc: i.desc } : {}), allergens: cleanAllergens(i.allergens) })),
    }));
  });