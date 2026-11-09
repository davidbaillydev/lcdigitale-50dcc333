import { useEffect, useRef } from "react";
import { Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ORDER_RINGTONE_CHOICES, playOrderSound, type OrderSound } from "@/lib/order-sound";

export function OrderSoundSettings({ value, onChange }: { value: OrderSound; onChange: (value: OrderSound) => void }) {
  const audio = useRef<AudioContext | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => { stop.current?.(); void audio.current?.close().catch(() => {}); }, []);
  const preview = async (ringtone: OrderSound["ringtone"]) => {
    try {
      stop.current?.();
      audio.current ??= new AudioContext();
      await audio.current.resume();
      stop.current = playOrderSound(audio.current, { ...value, ringtone });
    } catch { toast.error("Son indisponible : vérifiez le volume de votre appareil."); }
  };
  return <div className="space-y-4">
    <div className="space-y-2" role="radiogroup" aria-label="Sonnerie des commandes">
      {ORDER_RINGTONE_CHOICES.map((ring) => <div key={ring.id} className="flex items-center gap-2">
        <Button type="button" variant={value.ringtone === ring.id ? "default" : "outline"} role="radio" aria-checked={value.ringtone === ring.id} onClick={() => onChange({ ...value, ringtone: ring.id })} className="min-h-12 min-w-0 flex-1 justify-start whitespace-normal"><Volume2 className="shrink-0" />{ring.label}</Button>
        <Button type="button" variant="secondary" size="icon" className="size-12 shrink-0" aria-label={`Écouter ${ring.label}`} title={`Écouter ${ring.label}`} onClick={() => void preview(ring.id)}><Play /></Button>
      </div>)}
    </div>
    <div className="space-y-3"><Label htmlFor="order-sound-volume">Volume des commandes · {value.volume} %</Label><Slider id="order-sound-volume" aria-label="Volume des commandes" min={0} max={100} step={5} value={[value.volume]} onValueChange={([volume]) => onChange({ ...value, volume: volume ?? 100 })} className="min-h-11" /></div>
  </div>;
}