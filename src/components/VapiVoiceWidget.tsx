import { Loader2, Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
import { useVapi } from "@/hooks/useVapi";
import type { Restaurant } from "@/lib/shop";

export function VapiVoiceWidget({ restaurant }: { restaurant: Restaurant }) {
  const enabled = !!(restaurant.is_vapi_web_enabled && restaurant.vapi_assistant_id && restaurant.vapi_public_key);
  const v = useVapi(enabled ? restaurant.vapi_public_key : null);
  if (!enabled) return null;
  const active = v.isConnected || v.isConnecting;
  const bars = [0.5, 0.8, 1, 0.8, 0.5, 0.7, 0.9];

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6">
      {v.error && <p role="alert" className="max-w-xs rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-lg">{v.error}</p>}
      {active ? (
        <div className="w-72 animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {v.isConnecting ? "Connexion à Kaito…" : v.isSpeaking ? "Kaito vous répond…" : "Kaito vous écoute…"}
          </p>
          <div className="my-4 flex h-12 items-center justify-center gap-1" aria-hidden>
            {bars.map((b, i) => (
              <span key={i} className="w-2 rounded-full bg-primary transition-all duration-100"
                style={{ height: `${Math.max(12, Math.min(100, (v.isConnecting ? 0.2 : v.volumeLevel) * b * 140 + 12))}%` }} />
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={v.toggleMute} disabled={!v.isConnected} aria-label={v.isMuted ? "Réactiver le micro" : "Couper le micro"}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground transition hover:bg-muted disabled:opacity-50">
              {v.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button onClick={v.stopCall} aria-label="Raccrocher"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => v.startCall(restaurant.vapi_assistant_id!)}
          className="group flex items-center gap-3 rounded-full bg-card py-1.5 pl-4 pr-1.5 shadow-2xl ring-1 ring-border transition hover:-translate-y-0.5">
          <span className="hidden text-sm font-semibold sm:inline">Commander à la voix avec Kaito</span>
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            {v.isConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="relative h-5 w-5" />}
          </span>
        </button>
      )}
    </div>
  );
}
