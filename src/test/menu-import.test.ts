import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMenuFile } from "@/lib/menu-import";
import { readMenuResponse } from "@/lib/menu-import-response";

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(), getPage: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: pdf.getDocument }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker-url" }));

beforeEach(() => {
  vi.clearAllMocks();
  pdf.destroy.mockResolvedValue(undefined);
  pdf.getPage.mockResolvedValue({ getTextContent: async () => ({ items: [
    { str: "DESSERTS", hasEOL: true }, { str: "Mochi vanille 4,50 EUR", hasEOL: true },
    { str: "Fondant chocolat 6,00 EUR", hasEOL: true },
  ] }) });
  pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: pdf.getPage }), destroy: pdf.destroy });
});

describe("PDF text menu import", () => {
  it.each(["application/pdf", "", "application/octet-stream"])("preserves names and decimal prices with MIME %s", async (type) => {
    const file = { name: "CARTE.PDF", type, size: 100, arrayBuffer: async () => new ArrayBuffer(1) } as File;
    const pages = await readMenuFile(file);
    expect(pages).toEqual([{ type: "text", content: "Page 1\nDESSERTS\nMochi vanille 4,50 EUR\nFondant chocolat 6,00 EUR" }]);
    expect(pdf.destroy).toHaveBeenCalledOnce();
  });
  it("retains the eight-page limit and cleans up on rejection", async () => {
    pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 9 }), destroy: pdf.destroy });
    await expect(readMenuFile({ name: "menu.pdf", type: "application/pdf", size: 100, arrayBuffer: async () => new ArrayBuffer(1) } as File)).rejects.toThrow("8 pages");
    expect(pdf.destroy).toHaveBeenCalledOnce();
  });
});

function sse(events: unknown[]) {
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }));
}
describe("streamed menu analysis", () => {
  it("reads split frames without mixing reasoning with the menu", async () => {
    expect(await readMenuResponse(sse([
      { type: "response.reasoning_summary_text.delta", delta: "thinking" },
      { type: "response.output_text.delta", delta: '{"categories":' },
      { type: "response.output_text.delta", delta: "[]}" },
      { type: "response.completed", response: { status: "completed" } },
    ]))).toBe('{"categories":[]}');
  });
  it("rejects cancelled analysis rather than claiming the PDF is unreadable", async () => {
    await expect(readMenuResponse(sse([{ type: "response.output_text.delta", delta: "{" }]))).rejects.toThrow("interrompue");
  });
  it("does not accept a provider refusal", async () => {
    await expect(readMenuResponse(sse([
      { type: "response.refusal.done" }, { type: "response.completed", response: { status: "completed" } },
    ]))).rejects.toThrow("refusée");
  });
});