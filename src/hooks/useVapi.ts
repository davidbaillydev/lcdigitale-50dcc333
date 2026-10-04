import { useCallback, useEffect, useRef, useState } from "react";

type VapiInstance = {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => void;
  setMuted: (m: boolean) => void;
  on: (e: string, cb: (...a: unknown[]) => void) => void;
  removeAllListeners?: () => void;
};

/** Traduit une erreur brute du SDK en message clair pour le client. */
function friendlyError(raw: string | null | undefined): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("notallowed") || m.includes("permission") || m.includes("micro"))
    return "Le micro est bloqué. Autorisez le micro dans votre navigateur, puis réessayez.";
  if (m.includes("network") || m.includes("websocket") || m.includes("ice") || m.includes("connection") || m.includes("connexion"))
    return "La connexion vocale a échoué. Vérifiez votre réseau, puis réessayez.";
  if (m.includes("notfound") || m.includes("no device"))
    return "Aucun micro détecté sur cet appareil.";
  return raw?.trim() || "L'appel vocal a échoué. Veuillez réessayer.";
}

/** Cycle de vie d'un appel vocal Vapi dans le navigateur (SDK chargé à la demande, côté client uniquement). */
export function useVapi(publicKey: string | null | undefined) {
  const ref = useRef<VapiInstance | null>(null);
  const [isConnecting, setConnecting] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [isSpeaking, setSpeaking] = useState(false);
  const [volumeLevel, setVolume] = useState(0);
  const [isMuted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(async () => {
    if (ref.current) return ref.current;
    if (!publicKey) throw new Error("Assistant vocal non configuré");
    const { default: Vapi } = await import("@vapi-ai/web");
    const v = new Vapi(publicKey) as unknown as VapiInstance;
    v.on("call-start", () => { setConnecting(false); setConnected(true); setError(null); });
    v.on("call-end", () => { setConnecting(false); setConnected(false); setSpeaking(false); setVolume(0); setMuted(false); });
    v.on("speech-start", () => setSpeaking(true));
    v.on("speech-end", () => setSpeaking(false));
    v.on("volume-level", (l) => setVolume(typeof l === "number" ? l : 0));
    v.on("error", (e) => {
      setConnecting(false); setConnected(false);
      const msg = (e as { error?: { message?: string }; message?: string })?.error?.message ?? (e as { message?: string })?.message;
      setError(friendlyError(msg));
    });
    ref.current = v;
    return v;
  }, [publicKey]);

  const lastAssistantId = useRef<string | null>(null);

  const startCall = useCallback(async (assistantId: string) => {
    lastAssistantId.current = assistantId;
    setError(null); setConnecting(true);
    try { await (await ensure()).start(assistantId); }
    catch (e) { setConnecting(false); setError(friendlyError((e as Error).message)); }
  }, [ensure]);

  const retryCall = useCallback(() => {
    if (lastAssistantId.current) void startCall(lastAssistantId.current);
  }, [startCall]);

  const dismissError = useCallback(() => setError(null), []);

  const stopCall = useCallback(() => { ref.current?.stop(); setConnecting(false); }, []);
  const toggleMute = useCallback(() => {
    setMuted((m) => { ref.current?.setMuted(!m); return !m; });
  }, []);

  useEffect(() => () => { ref.current?.stop(); ref.current?.removeAllListeners?.(); ref.current = null; }, [publicKey]);

  return { startCall, retryCall, dismissError, stopCall, toggleMute, isConnecting, isConnected, isSpeaking, volumeLevel, isMuted, error };
}
