import { z } from "zod";
import kitchenAlert from "@/assets/sounds/sonnerie_alerte_cuisine.mp3.asset.json";
import softChime from "@/assets/sounds/sonnerie_carillon_doux.mp3.asset.json";

export const orderSoundSchema = z.object({ ringtone: z.enum(["chime", "welcome", "melody", "kitchen", "carillon"]), volume: z.number().int().min(0).max(100), repeatSeconds: z.number().int().min(3).max(120).default(5) });
export type OrderSound = z.infer<typeof orderSoundSchema>;
export const ORDER_RINGTONES = [
  { id: "chime", label: "Carillon lumineux", notes: [[523.25, 0], [659.25, 0.3], [783.99, 0.6], [1046.5, 0.95]] },
  { id: "welcome", label: "Accueil doux", notes: [[659.25, 0], [783.99, 0.25], [987.77, 0.5], [783.99, 0.85], [1046.5, 1.15]] },
  { id: "melody", label: "Mélodie joyeuse", notes: [[523.25, 0], [783.99, 0.18], [659.25, 0.36], [1046.5, 0.68], [783.99, 0.95], [1046.5, 1.22]] },
] as const;

/** Recorded ringtones supplied by the agency, played as decoded audio files. */
export const ORDER_FILE_RINGTONES = [
  { id: "kitchen", label: "Alerte cuisine percutante", url: kitchenAlert.url },
  { id: "carillon", label: "Carillon mélodique", url: softChime.url },
] as const;
export const ORDER_RINGTONE_CHOICES: { id: OrderSound["ringtone"]; label: string }[] = [...ORDER_RINGTONES, ...ORDER_FILE_RINGTONES];

const buffers = new Map<string, Promise<AudioBuffer>>();
function playFile(ctx: AudioContext, url: string, volume: number): () => void {
  let stopped = false; let source: AudioBufferSourceNode | null = null;
  let pending = buffers.get(url);
  if (!pending) { pending = fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)); buffers.set(url, pending); pending.catch(() => buffers.delete(url)); }
  void pending.then((buffer) => {
    if (stopped) return;
    const gain = ctx.createGain(); gain.gain.value = volume / 100;
    source = ctx.createBufferSource(); source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => { source?.disconnect(); gain.disconnect(); };
    source.start();
  }).catch(() => {});
  return () => { stopped = true; try { source?.stop(); } catch { /* ended */ } };
}

export function orderSoundOf(config?: { orderSound?: unknown } | null): OrderSound {
  const parsed = orderSoundSchema.safeParse(config?.orderSound);
  return parsed.success ? parsed.data : { ringtone: "chime", volume: 100, repeatSeconds: 5 };
}

/** Rounded, original major melodies. Compression limits overlapping peaks without clipping. */
export function playOrderSound(ctx: AudioContext, settings: OrderSound): () => void {
  if (settings.volume === 0) return () => {};
  const file = ORDER_FILE_RINGTONES.find((r) => r.id === settings.ringtone);
  if (file) return playFile(ctx, file.url, settings.volume);
  const ring = ORDER_RINGTONES.find((r) => r.id === settings.ringtone) ?? ORDER_RINGTONES[0];
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  const out = ctx.createGain();
  out.gain.value = settings.volume / 100;
  compressor.connect(out).connect(ctx.destination);
  const nodes: OscillatorNode[] = [];
  let remaining = ring.notes.length * 2;
  for (const [frequency, offset] of ring.notes) {
    for (const [multiple, amplitude] of [[1, 0.65], [2, 0.07]] as const) {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const at = ctx.currentTime + offset;
      const decay = settings.ringtone === "chime" ? 2.9 : 2.1;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(amplitude, at + 0.045);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      envelope.gain.linearRampToValueAtTime(0, at + decay + 0.2);
      oscillator.connect(envelope).connect(compressor);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect();
        if (--remaining === 0) { compressor.disconnect(); out.disconnect(); }
      };
      oscillator.start(at); oscillator.stop(at + decay + 0.25); nodes.push(oscillator);
    }
  }
  return () => nodes.forEach((node) => { try { node.stop(); } catch { /* already ended */ } });
}