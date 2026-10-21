import { GeminiUnavailable } from "./menu-gemini.server";

export type ImageConfig = { baseURL: string; apiKey: string; model: string };

export const imageSettings = { baseURL: "https://ai.gateway.lovable.dev", model: "openai/gpt-image-2.5-sunburst" };
export const GOOGLE_IMAGE_MODEL = "gemini-2.5-flash-image";

export function generateImage(config: ImageConfig, prompt: string, stream = true) {
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, prompt, size: "1536x1024", quality: "medium", ...(stream ? { stream: true, partial_images: 1 } : {}) }),
  });
}

/** Génère une photo via Nano Banana (Gemini 2.5 Flash Image) et la clé Google privée de l'agence. */
export async function generateGoogleImage(apiKey: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_IMAGE_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:2" } },
      }),
    });
  } catch {
    throw new GeminiUnavailable("Service Google Nano Banana indisponible");
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new GeminiUnavailable("Clé Google rejetée");
    if (response.status === 429) throw new GeminiUnavailable("Quota Google Nano Banana atteint");
    if (response.status === 404 || response.status >= 500) throw new GeminiUnavailable("Service Google Nano Banana indisponible");
    if (response.status === 403) throw new Error("Accès Google Nano Banana refusé. Vérifiez les autorisations du projet Google.");
    throw new Error("Google a refusé la création de cette photo.");
  }
  const payload = await response.json().catch(() => null) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
  } | null;
  if (payload?.promptFeedback?.blockReason) throw new Error("Google a refusé la création de cette photo.");
  for (const part of payload?.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return data;
  }
  throw new Error("Google a refusé la création de cette photo.");
}

export function imageSse(image: string): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: image_generation.completed\ndata: ${JSON.stringify({ type: "image_generation.completed", b64_json: image })}\n\n`));
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
