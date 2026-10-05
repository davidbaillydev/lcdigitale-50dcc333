import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadMenuPhoto } from "@/lib/menu-photos.functions";
import { imageDataUrl } from "@/lib/menu-import";
import { streamImage } from "@/lib/stream-image";
import type { MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

async function toJpeg(src: Blob | string): Promise<string> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const bmp = await createImageBitmap(blob);
  try { return imageDataUrl(bmp, bmp.width, bmp.height, 1200); } finally { bmp.close(); }
}

/** Photo d'un plat : import depuis l'appareil ou création par l'IA d'après le nom et la description. */
export function DishPhoto({ restaurantId, item, onChange }: { restaurantId: string; item: MenuItem; onChange: (url: string | undefined) => void }) {
  const upload = useServerFn(uploadMenuPhoto);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ src: string; final: boolean } | null>(null);
  const [busy, setBusy] = useState<"upload" | "ai" | null>(null);

  const save = async (dataUrl: string) => {
    const { url } = await upload({ data: { restaurantId, dataUrl } });
    onChange(url);
  };

  const fromFile = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Format accepté : JPG, PNG ou WebP"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Photo trop lourde (15 Mo maximum)"); return; }
    setBusy("upload");
    try { await save(await toJpeg(file)); toast.success("Photo ajoutée — enregistrez la carte pour la publier"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Import impossible"); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  };

  const generate = async () => {
    if (!item.name.trim() || item.name === "Nouveau plat") { toast.error("Donnez d'abord un nom au plat"); return; }
    setBusy("ai"); setPreview(null);
    try {
      const { data } = await supabase.auth.getSession();
      let final = "";
      await streamImage("/api/menu-photo-generate", { restaurantId, name: item.name, desc: item.desc ?? "" }, (src, isFinal) => {
        setPreview({ src, final: isFinal });
        if (isFinal) final = src;
      }, undefined, { Authorization: `Bearer ${data.session?.access_token ?? ""}` });
      if (!final) throw new Error("Aucune image reçue");
      await save(await toJpeg(final));
      toast.success("Photo créée — vérifiez-la puis enregistrez la carte");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(/402|crédit/i.test(msg) ? "Crédits IA épuisés : rechargez-les pour créer des photos" : /429/.test(msg) ? "Trop de demandes, réessayez dans un instant" : /403/.test(msg) ? "Réservé au gérant ou à l'agence" : "Création de la photo impossible, réessayez");
    } finally { setBusy(null); setPreview(null); }
  };

  const shown = preview?.src ?? item.image;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {shown ? <img src={shown} alt={item.name} className={cn("h-full w-full object-cover transition-[filter]", preview && !preview.final ? "blur-2xl" : "blur-0")} />
          : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">Sans photo</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void fromFile(e.target.files?.[0])} aria-label={`Importer la photo de ${item.name}`} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={() => input.current?.click()}><ImagePlus /> {busy === "upload" ? "Import…" : "Importer"}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={() => void generate()}><Sparkles /> {busy === "ai" ? "Création…" : item.image ? "Recréer avec l'IA" : "Créer avec l'IA"}</Button>
        {item.image && !busy && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)} aria-label="Retirer la photo"><Trash2 /></Button>}
      </div>
    </div>
  );
}
