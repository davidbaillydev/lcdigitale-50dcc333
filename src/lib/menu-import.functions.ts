import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLERGEN_IDS, cleanAllergens } from "./allergens";
import { menuOutputFormat, readMenuResponse } from "./menu-import-response";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gemini, error: settingsError } = await supabaseAdmin.from("agency_menu_ai_credentials").select("api_key").eq("id", "gemini").maybeSingle();
    if (settingsError) throw new Error("Impossible de charger le fournisseur d’analyse de carte");
    const content = [
      { type: "input_text", text: `Extrais la carte de restaurant jointe. Réponds UNIQUEMENT avec un JSON valide de forme {\"categories\":[{\"label\":\"...\",\"items\":[{\"name\":\"...\",\"desc\":\"...\",\"price\":12.5,\"allergens\":[\"gluten\"]}]}]}. Reprends exclusivement les plats et prix clairement lisibles ; ne devine aucun prix, ne crée pas de plat. Ignore les lignes sans prix vérifiable. Prix en euros numériques, virgule décimale convertie en point. Regroupe sous des catégories appropriées. Les options ou suppléments incertains sont à vérifier humainement. Pour chaque plat, renseigne \"allergens\" avec les identifiants parmi ${ALLERGEN_IDS.join(", ")} : ceux indiqués sur la carte (pictogrammes, mentions) ET ceux évidents d'après les ingrédients cités (ex. sushi/maki → poissons, sésame, soja via sauce ; tempura/nouilles de blé → gluten ; crevette → crustacés). Tableau vide si rien d'identifiable.` },
      ...data.pages.map((p) => p.type === "image"
        ? { type: "input_image", image_url: p.content }
        : { type: "input_text", text: p.content }),
    ];
    const { analyzeWithGemini, menuAnalysisWithFallback } = await import("./menu-gemini.server");
    const instruction = content[0];
    if (!instruction || !("text" in instruction) || typeof instruction.text !== "string") throw new Error("Instructions d’analyse manquantes");
    const geminiKey = gemini?.api_key;
    const raw = await menuAnalysisWithFallback(
      geminiKey ? () => analyzeWithGemini(geminiKey, instruction.text, data.pages) : undefined,
      async () => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("L'analyse de carte est momentanément indisponible");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", input: [{ role: "user", content }], stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"], text: { format: menuOutputFormat } }),
    });
    if (!response.ok) {
      console.error("menu-import gateway failure", { status: response.status, runId: response.headers.get("X-Lovable-AIG-Run-ID") });
      const message = response.status === 429 ? "Trop de demandes, réessayez plus tard"
        : response.status === 402 ? "Le crédit d’analyse IA est insuffisant. Contactez l’agence."
        : response.status === 401 || response.status === 403 ? "L’accès à l’analyse IA est indisponible. Contactez l’agence."
        : "L’analyse est momentanément indisponible. Votre carte n’a pas été modifiée.";
      throw new Error(message);
    }
    return readMenuResponse(response);
    },
    async (reason) => {
      const { error } = await supabaseAdmin.from("agency_menu_ai_credentials").update({ last_fallback_reason: reason, last_fallback_at: new Date().toISOString() }).eq("id", "gemini");
      if (error) throw new Error("Impossible d’enregistrer l’avertissement de repli IA. Réessayez plus tard.");
    });
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