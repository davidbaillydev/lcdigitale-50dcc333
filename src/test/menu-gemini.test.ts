import { describe, it, expect, vi, afterEach } from "vitest";
import { geminiMenuBody, readGeminiMenuResponse, analyzeWithGemini, GeminiUnavailable, menuAnalysisWithFallback } from "@/lib/menu-gemini.server";

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
  it.each(["Clé Gemini rejetée", "Quota Gemini atteint", "Service Gemini indisponible"])("falls back once and reports %s", async (reason) => {
    const fallback = vi.fn().mockResolvedValue("menu"); const report = vi.fn().mockResolvedValue(undefined);
    expect(await menuAnalysisWithFallback(async () => { throw new GeminiUnavailable(reason); }, fallback, report)).toBe("menu");
    expect(fallback).toHaveBeenCalledOnce(); expect(report).toHaveBeenCalledWith(reason);
  });
  it("never falls back after a refusal", async () => {
    const fallback = vi.fn(); const report = vi.fn();
    await expect(menuAnalysisWithFallback(async () => { throw new Error("refusé"); }, fallback, report)).rejects.toThrow("refusé");
    expect(fallback).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled();
  });
  it("does not hide a Lovable fallback failure", async () => {
    await expect(menuAnalysisWithFallback(async () => { throw new GeminiUnavailable("quota"); }, async () => { throw new Error("Crédits insuffisants"); }, async () => {})).rejects.toThrow("Crédits insuffisants");
  });
});