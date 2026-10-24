import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Restaurant } from "@/lib/shop";
import { brandVars } from "@/lib/brand";
import { saveRestaurantBanner, saveRestaurantBannerVideo } from "@/lib/restaurant-banner.functions";
import { RestaurantBanner } from "./RestaurantBanner";
import { Button } from "./ui/button";

async function readBanner(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choisissez une image JPG, PNG ou WebP");
  if (file.size > 20 * 1024 * 1024) throw new Error("L'image ne doit pas dépasser 20 Mo");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de lire cette image");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { bitmap.close(); }
}

function readVideo(file: File): Promise<string> {
  if (!["video/mp4", "video/webm"].includes(file.type)) return Promise.reject(new Error("Choisissez une vidéo MP4 ou WebM"));
  if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error("Vidéo trop lourde : 8 Mo maximum (10 à 15 secondes en 720p suffisent)"));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Impossible de lire cette vidéo"));
    r.readAsDataURL(file);
  });
}

export function RestaurantBannerUpload({ restaurant, onSaved }: { restaurant: Restaurant; onSaved?: (() => void) | undefined }) {
  const save = useServerFn(saveRestaurantBanner);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const saveVideo = useServerFn(saveRestaurantBannerVideo);
  const videoInput = useRef<HTMLInputElement>(null);
  const [videoPreview, setVideoPreview] = useState<string | null | undefined>(undefined);
  const chooseVideo = async (file: File) => {
    try { setVideoPreview(await readVideo(file)); } catch (e) { toast.error((e as Error).message); }
  };
  const submitVideo = async () => {
    if (videoPreview === undefined) return;
    setBusy(true);
    try {
      await saveVideo({ data: { restaurantId: restaurant.id, video: videoPreview } });
      onSaved?.(); toast.success(videoPreview ? "Vidéo enregistrée" : "Vidéo retirée"); setVideoPreview(undefined);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const choose = async (file: File) => {
    setBusy(true);
    try { setPreview(await readBanner(file)); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (preview === undefined) return;
    setBusy(true);
    try {
      await save({ data: { restaurantId: restaurant.id, image: preview } });
      onSaved?.(); toast.success(preview ? "Bannière enregistrée" : "Bannière retirée"); setPreview(undefined);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 border-b border-border pb-6" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !busy) void choose(file); }}>
      <h2 className="text-3xl">Bannière du restaurant</h2>
      <div style={brandVars(restaurant.brand)} className="relative aspect-[3/1] overflow-hidden rounded-md">
        <RestaurantBanner restaurant={restaurant} preview={preview} videoPreview={videoPreview} />
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choisir une bannière" className="sr-only" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus /> Choisir une bannière</Button>
        {(preview || (preview === undefined && restaurant.brand.bannerPath)) && <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}><Trash2 /> Retirer</Button>}
        {preview !== undefined && <>
          <Button disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : "Enregistrer la bannière"}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPreview(undefined)}>Annuler</Button>
        </>}
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="font-semibold">Vidéo d'en-tête (facultatif)</h3>
        <p className="text-sm text-muted-foreground">Remplace l'image par une courte vidéo muette en boucle. MP4 ou WebM, 8 Mo maximum (idéal : 10 à 15 s en 720p). L'image ci-dessus reste affichée pendant le chargement et pour les visiteurs qui économisent leurs données.</p>
        <input ref={videoInput} type="file" accept="video/mp4,video/webm" aria-label="Choisir une vidéo" className="sr-only" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void chooseVideo(file); e.target.value = ""; }} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => videoInput.current?.click()}><Film /> Choisir une vidéo</Button>
          {(videoPreview || (videoPreview === undefined && restaurant.brand.bannerVideoPath)) && <Button variant="ghost" disabled={busy} onClick={() => setVideoPreview(null)}><Trash2 /> Retirer la vidéo</Button>}
          {videoPreview !== undefined && <>
            <Button disabled={busy} onClick={submitVideo}>{busy ? "Enregistrement…" : "Enregistrer la vidéo"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setVideoPreview(undefined)}>Annuler</Button>
          </>}
        </div>
      </div>
    </section>
  );
}