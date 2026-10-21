import { afterEach, describe, expect, it, vi } from "vitest";
import { generateGoogleImage, GOOGLE_IMAGE_MODEL, imageSse } from "@/lib/image-gateway.server";
import { GeminiUnavailable } from "@/lib/menu-gemini.server";

afterEach(() => vi.unstubAllGlobals());

describe("Google Nano Banana dish photos", () => {
  it("requests one 3:2 image from gemini-2.5-flash-image via generateContent", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "YQ==" } }] } }] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(generateGoogleImage("test-fixture", "Sushi")).resolves.toBe("YQ==");
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${GOOGLE_IMAGE_MODEL}:generateContent`);
    expect(JSON.parse(String(init.body))).toMatchObject({
      contents: [{ parts: [{ text: "Sushi" }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:2" } },
    });
  });

  it.each([400, 401, 404, 429, 500])("marks status %s as eligible for Lovable fallback", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(generateGoogleImage("test-fixture", "Sushi")).rejects.toBeInstanceOf(GeminiUnavailable);
  });

  it("does not fall back after an access denial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    await expect(generateGoogleImage("test-fixture", "Sushi")).rejects.toThrow("refusé");
  });

  it("treats a blocked prompt as a refusal, not a fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ promptFeedback: { blockReason: "SAFETY" } })));
    await expect(generateGoogleImage("test-fixture", "Sushi")).rejects.toThrow("refusé");
  });

  it("streams the Google result as one completed image event", async () => {
    const response = imageSse("YQ==");
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toContain('"type":"image_generation.completed"');
  });
});
