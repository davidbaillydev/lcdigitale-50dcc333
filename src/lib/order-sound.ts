import { z } from "zod";
import kitchenAlert from "@/assets/sounds/sonnerie_alerte_cuisine.mp3.asset.json";
import softChime from "@/assets/sounds/sonnerie_carillon_doux.mp3.asset.json";

export const orderSoundSchema = z.object({ ringtone: z.enum(["carillon", "welcome", "melody", "kitchen"]), volume: z.number().int().min(0).max(100), repeatSeconds: z.number().int().min(3).max(120).default(5) });
export type OrderSound = z.infer<typeof orderSoundSchema>;
export const ORDER_RINGTONES = [
  { id: "welcome", label: "Accueil doux", notes: [[659.25, 0], [783.99, 0.25], [987.77, 0.5], [783.99, 0.85], [1046.5, 1.15]] },
  { id: "melody", label: "Mélodie joyeuse", notes: [[523.25, 0], [783.99, 0.18], [659.25, 0.36], [1046.5, 0.68], [783.99, 0.95], [1046.5, 1.22]] },
] as const;

/** Recorded ringtones supplied by the agency, played as decoded audio files. */
export const ORDER_FILE_RINGTONES = [
  { id: "carillon", label: "Carillon mélodique", url: softChime.url },
  { id: "kitchen", label: "Alerte cuisine percutante", url: kitchenAlert.url },
] as const;
/** Display order: the default recorded carillon first, then the synthesized melodies and the punchy alert. */
export const ORDER_RINGTONE_CHOICES: { id: OrderSound["ringtone"]; label: string }[] = [...ORDER_FILE_RINGTONES, ...ORDER_RINGTONES];

const buffers = new Map<string, Promise<AudioBuffer>>();
function playFile(ctx: AudioContext, url: string, volume: number, onEnd?: () => void): () => void {
  let stopped = false; let source: AudioBufferSourceNode | null = null;
  let pending = buffers.get(url);
  if (!pending) { pending = fetch(url).then((r) => { if (!r.ok) throw new Error("Audio unavailable"); return r.arrayBuffer(); }).then((b) => ctx.decodeAudioData(b)); buffers.set(url, pending); pending.catch(() => buffers.delete(url)); }
  void pending.then((buffer) => {
    if (stopped) { onEnd?.(); return; }
    const gain = ctx.createGain(); gain.gain.value = volume / 100;
    source = ctx.createBufferSource(); source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => { source?.disconnect(); gain.disconnect(); onEnd?.(); };
    source.start();
  }).catch(() => { onEnd?.(); });
  return () => { stopped = true; try { source?.stop(); } catch { /* ended */ } };
}

/** "Carillon lumineux" was retired at the agency's request: settings still pointing to it fall back to the recorded carillon. */
function migrateRingtone(raw: unknown): unknown {
  if (raw && typeof raw === "object" && (raw as { ringtone?: unknown }).ringtone === "chime") return { ...raw, ringtone: "carillon" };
  return raw;
}

export function orderSoundOf(config?: { orderSound?: unknown } | null): OrderSound {
  const parsed = orderSoundSchema.safeParse(migrateRingtone(config?.orderSound));
  return parsed.success ? parsed.data : { ringtone: "carillon", volume: 100, repeatSeconds: 5 };
}

/** Rounded, original major melodies. Compression limits overlapping peaks without clipping. */
export function playOrderSound(ctx: AudioContext, settings: OrderSound, onEnd?: () => void): () => void {
  if (settings.volume === 0) { onEnd?.(); return () => {}; }
  const file = ORDER_FILE_RINGTONES.find((r) => r.id === settings.ringtone);
  if (file) return playFile(ctx, file.url, settings.volume, onEnd);
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
      const decay = 2.1;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(amplitude, at + 0.045);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      envelope.gain.linearRampToValueAtTime(0, at + decay + 0.2);
      oscillator.connect(envelope).connect(compressor);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect();
        if (--remaining === 0) { compressor.disconnect(); out.disconnect(); onEnd?.(); }
      };
      oscillator.start(at); oscillator.stop(at + decay + 0.25); nodes.push(oscillator);
    }
  }
  return () => nodes.forEach((node) => { try { node.stop(); } catch { /* already ended */ } });
}