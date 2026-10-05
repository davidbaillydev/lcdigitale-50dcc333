import { useEffect, useState } from "react";

export type Consent = { audience: boolean; voice: boolean; at: number };
const KEY = "lc-cookie-consent";
const EVT = "lc-consent";
const MAX_AGE = 1000 * 60 * 60 * 24 * 182;

export function readConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Consent | null;
    return c && Date.now() - c.at < MAX_AGE ? c : null;
  } catch { return null; }
}
export function writeConsent(c: Omit<Consent, "at">) {
  localStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() }));
  window.dispatchEvent(new CustomEvent(EVT, { detail: "saved" }));
}
export function openCookieSettings() { window.dispatchEvent(new CustomEvent(EVT, { detail: "open" })); }

/** Choix de l'utilisateur, lu après hydratation (null = pas encore choisi). */
export function useConsent() {
  const [c, setC] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setC(readConsent()); setReady(true);
    const on = () => setC(readConsent());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return { consent: c, ready };
}
export const CONSENT_EVENT = EVT;
