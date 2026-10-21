import { GeminiUnavailable } from "./menu-gemini.server";

export type ImageConfig = { baseURL: string; apiKey: string; model: string };

export const imageSettings = { baseURL: "https://ai.gateway.lovable.dev", model: "openai/gpt-image-2.5-sunburst" };
export const GOOGLE_IMAGE_MODEL = "imagen-3.0-generate-002";

export function generateImage(config: ImageConfig, prompt: string, stream = true) {
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, prompt, size: "1536x1024", quality: "medium", ...(stream ? { stream: true, partial_images: 1 } : {}) }),
  });
}

/** Génère une photo via Imagen 3 et la clé Google privée de l'agence. */
export async function generateGoogleImage(apiKey: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_IMAGE_MODEL}:predict`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "3:2", personGeneration: "dont_allow" },
      }),
    });
  } catch {
    throw new GeminiUnavailable("Service Google Imagen indisponible");
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new GeminiUnavailable("Clé Google rejetée");
    if (response.status === 429) throw new GeminiUnavailable("Quota Google Imagen atteint");
    if (response.status === 404 || response.status >= 500) throw new GeminiUnavailable("Service Google Imagen indisponible");
    if (response.status === 403) throw new Error("Accès Google Imagen refusé. Vérifiez les autorisations du projet Google.");
    throw new Error("Google Imagen a refusé la création de cette photo.");
  }
  const payload = await response.json().catch(() => null) as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] } | null;
  const image = payload?.predictions?.[0]?.bytesBase64Encoded;
  if (!image) throw new Error("Google Imagen n'a renvoyé aucune photo");
  return image;
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
