export type ImportPage = { type: "text" | "image"; content: string };

const MAX_FILE = 8 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export function imageDataUrl(source: CanvasImageSource, width: number, height: number, max = 1600): string {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de lire cette image");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function readMenuFile(file: File): Promise<ImportPage[]> {
  if (file.size > MAX_FILE) throw new Error("Fichier trop volumineux (8 Mo maximum)");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (imageTypes.includes(file.type) && ["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
    const bitmap = await createImageBitmap(file);
    try { return [{ type: "image", content: imageDataUrl(bitmap, bitmap.width, bitmap.height) }]; }
    finally { bitmap.close(); }
  }
  if (file.type === "application/pdf" && ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (doc.numPages > 8) throw new Error("Le document ne doit pas dépasser 8 pages");
    const pages: ImportPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de lire le PDF");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      pages.push({ type: "image", content: canvas.toDataURL("image/jpeg", 0.8) });
    }
    return pages;
  }
  if (file.type === "text/plain" || file.type === "text/csv" || ["txt", "csv"].includes(ext ?? "")) {
    return [{ type: "text", content: (await file.text()).slice(0, 100_000) }];
  }
  throw new Error("Format accepté : PDF, JPG, PNG, WebP, TXT ou CSV");
}