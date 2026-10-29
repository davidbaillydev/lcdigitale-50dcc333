/** Borne : délai d'inactivité avant retour à l'accueil (panier vidé). */
export const KIOSK_IDLE_MS = 60_000;
/** Écran « commande terminée » : retour automatique pour le client suivant. */
export const KIOSK_DONE_MS = 15_000;
export const KIOSK_WARN_MS = 15_000;

/** Action à mener selon l'étape et le temps écoulé depuis la dernière interaction. */
export function kioskIdleAction(step: string, idleMs: number): "none" | "warn" | "reset" {
  if (step === "welcome" || step === "qr" || step === "terminal") return "none";
  const limit = step === "done" ? KIOSK_DONE_MS : KIOSK_IDLE_MS;
  if (idleMs > limit) return "reset";
  if (step !== "done" && idleMs > limit - KIOSK_WARN_MS) return "warn";
  return "none";
}
