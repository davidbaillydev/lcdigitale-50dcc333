import { useEffect, useRef, useState } from "react";
import { Play, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ORDER_RINGTONE_CHOICES, playOrderSound, type OrderSound } from "@/lib/order-sound";

export function OrderSoundSettings({ value, onChange }: { value: OrderSound; onChange: (value: OrderSound) => void }) {
  const audio = useRef<AudioContext | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState<OrderSound["ringtone"] | null>(null);
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => () => { stop.current?.(); clearTimer(); void audio.current?.close().catch(() => {}); }, []);
  const preview = async (ringtone: OrderSound["ringtone"]) => {
    if (playing === ringtone) { stop.current?.(); stop.current = null; clearTimer(); setPlaying(null); return; }
    try {
      stop.current?.();
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setPlaying(ringtone);
      // Safety net: if the browser never reports the end of playback, the button must not stay on "Arrêter".
      clearTimer();
      timer.current = setTimeout(() => setPlaying((current) => (current === ringtone ? null : current)), 8000);
      stop.current = playOrderSound(audio.current, { ...value, ringtone }, () => { clearTimer(); setPlaying((current) => (current === ringtone ? null : current)); });
    } catch { clearTimer(); setPlaying(null); toast.error("Son indisponible : vérifiez le volume de votre appareil."); }
  };
  const selected = ORDER_RINGTONE_CHOICES.find((ring) => ring.id === value.ringtone)?.label ?? value.ringtone;
  const listenButton = (ringtone: OrderSound["ringtone"], label: string, wide: boolean) => {
    const isPlaying = playing === ringtone;
    return <Button type="button" variant={isPlaying ? "default" : "outline"} aria-pressed={isPlaying}
      aria-label={isPlaying ? `Arrêter ${label}` : wide ? `Écouter la sonnerie sélectionnée (${label})` : `Écouter ${label}`} title={isPlaying ? `Arrêter ${label}` : `Écouter ${label}`}
      onClick={() => void preview(ringtone)} className={wide ? "min-h-12 w-full gap-2" : "min-h-12 shrink-0 gap-2 px-3"}>
      {isPlaying ? <Square className="size-4 shrink-0" /> : <Play className="size-4 shrink-0" />}
      <span className="truncate">{isPlaying ? "Arrêter" : wide ? `Écouter · ${label}` : "Écouter"}</span>
    </Button>;
  };
  return <div className="space-y-4">
    <div className="space-y-2" role="radiogroup" aria-label="Sonnerie des commandes">
      {ORDER_RINGTONE_CHOICES.map((ring) => <div key={ring.id} className="flex items-center gap-2">
        <Button type="button" variant={value.ringtone === ring.id ? "default" : "outline"} role="radio" aria-checked={value.ringtone === ring.id} onClick={() => onChange({ ...value, ringtone: ring.id })} className="min-h-12 min-w-0 flex-1 justify-start whitespace-normal"><Volume2 className="shrink-0" />{ring.label}{value.ringtone === ring.id && <span className="ml-auto pl-2 text-xs font-normal opacity-80">En cours</span>}</Button>
        {listenButton(ring.id, ring.label, false)}
      </div>)}
    </div>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Écouter avant d'activer</p>
      <p className="text-sm text-muted-foreground">La sonnerie sélectionnée est jouée avec votre volume actuel. Rien n'est activé tant que vous n'avez pas enregistré les réglages.</p>
      {listenButton(value.ringtone, selected, true)}
    </div>
    <div className="space-y-3"><Label htmlFor="order-sound-volume">Volume des commandes · {value.volume} %</Label><Slider id="order-sound-volume" aria-label="Volume des commandes" min={0} max={100} step={5} value={[value.volume]} onValueChange={([volume]) => onChange({ ...value, volume: volume ?? 100 })} className="min-h-11" /></div>
    <div className="space-y-3"><Label htmlFor="order-sound-repeat">Répéter la sonnerie toutes les {value.repeatSeconds} secondes (tant qu'une commande n'est pas acceptée)</Label><Slider id="order-sound-repeat" aria-label="Intervalle de répétition" min={3} max={60} step={1} value={[value.repeatSeconds]} onValueChange={([repeatSeconds]) => onChange({ ...value, repeatSeconds: repeatSeconds ?? 5 })} className="min-h-11" /></div>
  </div>;
}
