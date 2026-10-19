import { createParser } from "eventsource-parser";

export const menuOutputFormat = {
  type: "json_schema", name: "restaurant_menu", strict: true,
  schema: {
    type: "object", additionalProperties: false, required: ["categories"],
    properties: { categories: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["label", "items"],
      properties: {
        label: { type: "string" },
        items: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["name", "desc", "price", "allergens"],
          properties: { name: { type: "string" }, desc: { type: "string" }, price: { type: "number" }, allergens: { type: "array", items: { type: "string" } } },
        } },
      },
    } } },
  },
} as const;

/** Consume split SSE frames; never mistake a truncated response for a bad PDF. */
export async function readMenuResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error("L’analyse n’a renvoyé aucun résultat. Réessayez plus tard.");
  let text = "";
  let completed = false;
  let failure: string | undefined;
  const parser = createParser({ onEvent(event) {
    if (event.data === "[DONE]") return;
    const data = JSON.parse(event.data) as { type?: string; delta?: string; response?: { status?: string } };
    if (data.type === "response.output_text.delta") text += data.delta ?? "";
    if (data.type === "response.completed") completed = data.response?.status === "completed";
    if (data.type === "response.refusal.delta" || data.type === "response.refusal.done") failure = "L’analyse de ce document a été refusée.";
    if (["error", "response.failed", "response.incomplete"].includes(data.type ?? "")) failure = "L’analyse a été interrompue. La carte n’a pas été modifiée.";
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
  if (failure) throw new Error(failure);
  if (!completed) throw new Error("L’analyse a été interrompue. La carte n’a pas été modifiée.");
  if (!text.trim()) throw new Error("L’analyse n’a renvoyé aucun plat. Vérifiez que les prix figurent dans le document.");
  return text;
}