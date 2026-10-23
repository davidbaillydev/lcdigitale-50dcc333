import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Restaurant } from "@/lib/shop";
import { saveRestaurantCover } from "@/lib/restaurant-cover.functions";
import { Button } from "./ui/button";

async function readCover(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choisissez une image JPG, PNG ou WebP");
  if (file.size > 20 * 1024 * 1024) throw new Error("L'image ne doit pas dépasser 20 Mo");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de lire cette image");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { bitmap.close(); }
}

export function RestaurantCoverUpload({ restaurant, onSaved }: { restaurant: Restaurant; onSaved?: (() => void) | undefined }) {
  const save = useServerFn(saveRestaurantCover);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const current = preview !== undefined ? preview : restaurant.brand.coverUrl ?? null;
  const choose = async (file: File) => {
    setBusy(true);
    try { setPreview(await readCover(file)); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (preview === undefined) return;
    setBusy(true);
    try { await save({ data: { restaurantId: restaurant.id, image: preview } }); onSaved?.(); toast.success(preview ? "Photo de couverture enregistrée" : "Photo de couverture retirée"); setPreview(undefined); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 border-b border-border pb-6">
      <div>
        <h2 className="text-3xl">Photo de couverture</h2>
        <p className="text-sm text-muted-foreground">Vignette affichée sur la carte de l'établissement dans l'annuaire des restaurants.</p>
      </div>
      <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-md border border-border bg-muted">
        {current ? <img src={current} alt={`Couverture de ${restaurant.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">Aucune photo : le logo sera affiché</div>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choisir une photo de couverture" className="sr-only" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus /> Choisir une photo</Button>
        {current && <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}><Trash2 /> Retirer</Button>}
        {preview !== undefined && <>
          <Button disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : "Enregistrer la photo"}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPreview(undefined)}>Annuler</Button>
        </>}
      </div>
    </section>
  );
}
