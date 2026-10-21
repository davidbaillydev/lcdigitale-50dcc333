import { createParser } from "eventsource-parser";

export const GEMINI_MENU_MODEL = "gemini-2.5-flash";
type Page = { type: "text" | "image"; content: string };

export function geminiMenuBody(prompt: string, pages: Page[]) {
  const parts = [{ text: prompt }, ...pages.map((page) => {
    if (page.type === "text") return { text: page.content };
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(page.content);
    if (!match) throw new Error("Format d’image non pris en charge pour Gemini");
    return { inline_data: { mime_type: match[1], data: match[2] } };
  })];
  const responseSchema = {
    type: "OBJECT", required: ["categories"], properties: {
      categories: { type: "ARRAY", items: {
        type: "OBJECT", required: ["label", "items"], properties: {
          label: { type: "STRING" }, items: { type: "ARRAY", items: {
            type: "OBJECT", required: ["name", "desc", "price", "allergens"], properties: {
              name: { type: "STRING" }, desc: { type: "STRING" }, price: { type: "NUMBER" },
              allergens: { type: "ARRAY", items: { type: "STRING" } },
            },
          } },
        },
      } },
    },
  };
  const body = { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", responseSchema } };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 18_000_000) throw new Error("Document trop volumineux pour Gemini. Importez moins de pages à la fois.");
  return body;
}

export async function readGeminiMenuResponse(response: Response) {
  if (!response.body) throw new Error("Gemini n’a renvoyé aucun résultat");
  let text = "";
  let finish: string | undefined;
  let blocked = false;
  let failed = false;
  const parser = createParser({ onEvent(event) {
    const data = JSON.parse(event.data) as {
      error?: unknown; promptFeedback?: { blockReason?: string };
      candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    if (data.error) failed = true;
    if (data.promptFeedback?.blockReason) blocked = true;
    const candidate = data.candidates?.[0];
    for (const part of candidate?.content?.parts ?? []) if (!part.thought) text += part.text ?? "";
    if (candidate?.finishReason) finish = candidate.finishReason;
  } });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
  } finally { reader.releaseLock(); }
  if (blocked || (finish && !["STOP", "MAX_TOKENS"].includes(finish))) throw new Error("Gemini a refusé l’analyse de ce document. La carte n’a pas été modifiée.");
  if (failed || finish !== "STOP") throw new Error("L’analyse Gemini a été interrompue. La carte n’a pas été modifiée.");
  if (!text.trim()) throw new Error("Gemini n’a trouvé aucun plat lisible");
  return text;
}

export async function analyzeWithGemini(apiKey: string, prompt: string, pages: Page[]) {
  const body = geminiMenuBody(prompt, pages);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MENU_MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    // Never return/log Google error payloads: they may contain credential material.
    const message = response.status === 400 || response.status === 401 ? "Clé Gemini invalide ou demande non acceptée. Vérifiez la clé dans la console agence."
      : response.status === 403 ? "Accès Gemini refusé. Vérifiez les autorisations du projet Google."
      : response.status === 429 ? "Quota Gemini atteint. Vérifiez les quotas et la facturation du compte Google."
      : response.status === 404 ? "Le modèle Gemini d’analyse est indisponible."
      : "Gemini est momentanément indisponible. La carte n’a pas été modifiée.";
    throw new Error(message);
  }
  return readGeminiMenuResponse(response);
}