import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONSENT_EVENT, readConsent, writeConsent } from "@/lib/consent";

export function CookieConsent({ slug, voice, compact }: { slug: string; voice: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [aud, setAud] = useState(false);
  const [vc, setVc] = useState(false);
  useEffect(() => {
    const c = readConsent();
    if (!c) setOpen(true); else { setAud(c.audience); setVc(c.voice); }
    const on = (e: Event) => { if ((e as CustomEvent).detail === "open") { setCustom(true); setOpen(true); } };
    window.addEventListener(CONSENT_EVENT, on);
    return () => window.removeEventListener(CONSENT_EVENT, on);
  }, []);
  if (!open) return null;
  const done = (audience: boolean, v: boolean) => { writeConsent({ audience, voice: v }); setOpen(false); };
  return (
    <div role="dialog" aria-label="Choix des cookies" className={compact ? "fixed inset-x-0 bottom-0 z-50 p-2" : "fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md"}>
      <div className={`rounded-2xl border border-border bg-card text-card-foreground shadow-lg ${compact ? "space-y-2 p-3 text-sm" : "space-y-3 p-4"}`}>
        <p className="font-semibold">Vos choix de cookies</p>
        <p className="text-sm text-muted-foreground">
          Nous utilisons des traceurs indispensables au panier et au paiement. Avec votre accord, nous en utilisons d'autres pour mesurer l'audience{voice ? " et charger l'assistant vocal Kaito" : ""}.{" "}
          <Link to="/$slug/cookies" params={{ slug }} className="underline">En savoir plus</Link>
        </p>
        {custom && (
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between gap-3"><span>Indispensables</span><Switch checked disabled /></label>
            <label className="flex items-center justify-between gap-3"><span>Mesure d'audience</span><Switch checked={aud} onCheckedChange={setAud} /></label>
            {voice && <label className="flex items-center justify-between gap-3"><span>Assistant vocal Kaito</span><Switch checked={vc} onCheckedChange={setVc} /></label>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => done(false, false)}>Refuser</Button>
          <Button onClick={() => done(true, true)}>Accepter</Button>
          {custom
            ? <Button variant="outline" className="col-span-2" onClick={() => done(aud, vc)}>Enregistrer mes choix</Button>
            : <Button variant="ghost" className="col-span-2" onClick={() => setCustom(true)}>Personnaliser</Button>}
        </div>
      </div>
    </div>
  );
}
