import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateGoogleImage, generateImage, imageSettings, imageSse } from "@/lib/image-gateway.server";
import { GeminiUnavailable } from "@/lib/menu-gemini.server";
...
    const { name, desc, stream = true } = parsed.data;
    const prompt = `Professional appetizing food photograph of the restaurant dish "${name}"${desc ? `, described as: ${desc}` : ""}. Served on a plate, realistic, natural soft light, shallow depth of field, 3/4 overhead angle, clean neutral background, no text, no logo, no people.`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: google } = await supabaseAdmin.from("agency_menu_ai_credentials").select("api_key").eq("id", "gemini").maybeSingle();
    if (google?.api_key) {
      try {
        return imageSse(await generateGoogleImage(google.api_key, prompt));
      } catch (error) {
        if (!(error instanceof GeminiUnavailable)) {
          const message = error instanceof Error ? error.message : "Création Google Imagen impossible";
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
