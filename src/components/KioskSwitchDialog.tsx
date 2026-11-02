import { useState } from "react";
import { Lock, Monitor, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { verifyKioskSwitchPin } from "@/lib/kitchen-pin.functions";
import { kioskChoices } from "@/lib/kiosk-switch";
import { cn } from "@/lib/utils";

/**
 * Choix de la borne active sur cet appareil (ouvert par appui long) : numéro + libellé.
 * Rien n'est envoyé au serveur : la borne se souvient d'elle-même et adresse son propre terminal.
 */
export function KioskSwitchDialog(props: {
  restaurantId: string;
  config: unknown;
  current: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PinGate restaurantId={props.restaurantId} onClose={props.onClose} onOk={() => setUnlocked(true)} />;
  return <Switcher {...props} />;
}

const MSG = { wrong: "Code incorrect", locked: "Trop d'essais : réessayez dans 5 minutes", no_pin: "Aucun code PIN des bornes n'est défini : demandez à l'agence de le configurer.", error: "Vérification impossible, réessayez" };

/** Verrou : le code PIN cuisine du restaurant est vérifié côté serveur avant d'afficher le sélecteur. */
function PinGate({ restaurantId, onOk, onClose }: { restaurantId: string; onOk: () => void; onClose: () => void }) {
  const verify = useServerFn(verifyKioskSwitchPin);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await verify({ data: { restaurantId, pin } });
      if (r.ok) onOk(); else { setErr(MSG[r.reason ?? "wrong"]); setPin(""); }
    } catch { setErr(MSG.error); setPin(""); }
    setBusy(false);
  };
  const press = (d: string) => { setErr(null); setPin((p) => (p.length < 6 ? p + d : p)); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Code personnel" className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-background p-8">
      <button onClick={onClose} aria-label="Fermer" className="absolute right-8 top-8 rounded-xl bg-muted p-4"><X className="h-8 w-8" /></button>
      <p className="flex items-center gap-3 font-display text-5xl"><Lock className="h-10 w-10 text-primary" />Réservé au personnel</p>
      <p className="text-xl text-muted-foreground">Saisissez le code PIN des bornes pour changer de borne.</p>
      <p aria-label="Code saisi" className="h-14 text-5xl tracking-[0.5em]">{"•".repeat(pin.length)}</p>
      {err && <p role="alert" className="text-xl font-semibold text-destructive">{err}</p>}
      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-20 w-24 rounded-2xl bg-card text-3xl font-semibold border border-border">{d}</button>
        ))}
        <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-20 w-24 rounded-2xl bg-muted text-xl">Effacer</button>
        <button onClick={() => press("0")} className="h-20 w-24 rounded-2xl bg-card text-3xl font-semibold border border-border">0</button>
        <button onClick={submit} disabled={pin.length < 4 || busy} className="h-20 w-24 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-40">OK</button>
      </div>
    </div>
  );
}

function Switcher({ config, current, onPick, onClose }: { config: unknown; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const [other, setOther] = useState("");
  const choices = kioskChoices(config);
  return (
    <div role="dialog" aria-modal="true" aria-label="Changer de borne" className="absolute inset-0 z-[70] flex flex-col bg-background p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-3 font-display text-5xl"><Monitor className="h-10 w-10 text-primary" />Quelle borne est-ce ?</p>
        <button onClick={onClose} aria-label="Fermer" className="rounded-xl bg-muted p-4"><X className="h-8 w-8" /></button>
      </div>
      <p className="mt-2 text-xl text-muted-foreground">Le numéro choisit le terminal de paiement de cette borne. Il est mémorisé sur cet appareil uniquement.</p>
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {choices.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {choices.map((k) => (
              <button key={k.id} onClick={() => onPick(k.id)}
                className={cn("flex min-h-20 items-center justify-between gap-3 rounded-2xl border-2 px-6 py-5 text-left text-2xl font-semibold",
                  k.id === current ? "border-primary bg-primary/10" : "border-border bg-card")}>
                <span>{k.label || `Borne ${k.id}`}</span>
                <span className="text-primary">Borne {k.id}</span>
              </button>
            ))}
          </div>
        )}
        <label className="mt-6 block text-xl font-semibold">
          Autre numéro
          <span className="mt-2 flex gap-3">
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="ex. 3"
              className="min-h-16 flex-1 rounded-xl border-2 border-border bg-card px-5 text-2xl" />
            <button onClick={() => other.trim() && onPick(other.trim())} disabled={!other.trim()}
              className="rounded-xl bg-primary px-8 text-2xl font-semibold text-primary-foreground disabled:opacity-40">Utiliser</button>
          </span>
        </label>
        <p className="mt-2 text-lg text-muted-foreground">Lettres, chiffres ou tirets. Une borne sans numéro utilise le terminal du restaurant.</p>
      </div>
      <div className="mt-6 flex gap-4">
        {current && <button onClick={() => onPick(null)} className="flex-1 rounded-2xl bg-muted py-6 text-2xl font-semibold">Retirer le numéro</button>}
        <button onClick={onClose} className="flex-1 rounded-2xl bg-primary py-6 text-2xl font-semibold text-primary-foreground">Terminé</button>
      </div>
    </div>
  );
}
