import { describe, it, expect, vi, afterEach } from "vitest";
import { geminiMenuBody, readGeminiMenuResponse, analyzeWithGemini } from "@/lib/menu-gemini.server";

function sse(events: unknown[]) {
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }));
}
afterEach(() => vi.unstubAllGlobals());
describe("Gemini menu extraction", () => {
  it("sends text and real MIME inline images with a typed menu schema", () => {
    const body = geminiMenuBody("Extract", [{ type: "text", content: "Mochi 4,50 €" }, { type: "image", content: "data:image/png;base64,YQ==" }]);
    expect(body.contents[0]?.parts).toEqual([{ text: "Extract" }, { text: "Mochi 4,50 €" }, { inline_data: { mime_type: "image/png", data: "YQ==" } }]);
    expect(body.generationConfig.responseSchema.properties.categories.items.properties.items.items.properties.price.type).toBe("NUMBER");
  });
  it("rejects remote images before submitting", () => {
    expect(() => geminiMenuBody("Extract", [{ type: "image", content: "https://example.test/image.png" }])).toThrow("Format");
  });
  it("accepts completed split SSE without thinking text", async () => {
    expect(await readGeminiMenuResponse(sse([
      { candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text: '{"categories":' }] } }] },
      { candidates: [{ content: { parts: [{ text: "[]}" }] }, finishReason: "STOP" }] },
    ]))).toBe('{"categories":[]}');
  });
  it("rejects partial output", async () => {
    await expect(readGeminiMenuResponse(sse([{ candidates: [{ content: { parts: [{ text: "{" }] } }] }]))).rejects.toThrow("interrompue");
  });
  it("rejects safety refusal", async () => {
    await expect(readGeminiMenuResponse(sse([{ promptFeedback: { blockReason: "SAFETY" } }]))).rejects.toThrow("refusé");
  });
  it("stops quota failures without retries or another provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(analyzeWithGemini("test-fixture", "Extract", [{ type: "text", content: "Mochi 4,50 €" }])).rejects.toThrow("Quota Gemini");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});