import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Restaurant } from "@/lib/shop";
import { saveRestaurantCover } from "@/lib/restaurant-cover.functions";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

async function toCoverJpeg(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
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

async function readCover(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choisissez une image JPG, PNG ou WebP");
  if (file.size > 20 * 1024 * 1024) throw new Error("L'image ne doit pas dépasser 20 Mo");
  return toCoverJpeg(file);
}

export function RestaurantCoverUpload({ restaurant, onSaved }: { restaurant: Restaurant; onSaved?: (() => void) | undefined }) {
  const save = useServerFn(saveRestaurantCover);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ src: string; final: boolean } | null>(null);
  const [context, setContext] = useState("");
  const current = ai?.src ?? (preview !== undefined ? preview : restaurant.brand.coverUrl ?? null);
  const choose = async (file: File) => {
    setBusy(true);
    try { setPreview(await readCover(file)); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const generate = async () => {
    setBusy(true); setAi(null);
    try {
      const { data } = await supabase.auth.getSession();
      let final = "";
      const hint = [context.trim(), restaurant.city ? `Situé à ${restaurant.city}` : ""].filter(Boolean).join(". ");
      await streamImage("/api/menu-photo-generate", { restaurantId: restaurant.id, name: restaurant.name, desc: hint.slice(0, 500), kind: "cover" }, (src, isFinal) => {
        setAi({ src, final: isFinal });
        if (isFinal) final = src;
      }, undefined, { Authorization: `Bearer ${data.session?.access_token ?? ""}` });
      if (!final) throw new Error("Aucune image reçue");
      setPreview(await toCoverJpeg(await (await fetch(final)).blob()));
      toast.success("Photo créée — vérifiez-la puis cliquez sur « Enregistrer la photo »");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(/402|crédit/i.test(msg) ? "Crédits IA épuisés : rechargez-les pour créer des photos" : /429/.test(msg) ? "Trop de demandes, réessayez dans un instant" : /403/.test(msg) ? "Réservé au gérant ou à l'agence" : /refus/i.test(msg) ? msg : "Création de la photo impossible, réessayez");
    } finally { setBusy(false); setAi(null); }
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
        {current ? <img src={current} alt={`Couverture de ${restaurant.name}`} className={cn("h-full w-full object-cover transition-[filter]", ai && !ai.final ? "blur-2xl" : "blur-0")} /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">Aucune photo : le logo sera affiché</div>}
      </div>
      <div className="max-w-sm space-y-2">
        <label htmlFor="cover-ai-context" className="text-sm font-medium">Décrivez l'image souhaitée (pour l'IA)</label>
        <Textarea id="cover-ai-context" value={context} maxLength={400} disabled={busy} onChange={(e) => setContext(e.target.value)} placeholder="Ex. : restaurant asiatique, plateau de sushis et wok fumant, ambiance chaleureuse noir et or" />
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choisir une photo de couverture" className="sr-only" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus /> Choisir une photo</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void generate()}><Sparkles /> {busy && ai ? "Création…" : "Créer avec l'IA"}</Button>
        {current && !ai && <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}><Trash2 /> Retirer</Button>}
        {preview !== undefined && !ai && <>
          <Button disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : "Enregistrer la photo"}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPreview(undefined)}>Annuler</Button>
        </>}
      </div>
    </section>
  );
}
