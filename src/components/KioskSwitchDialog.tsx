import { useState } from "react";
import { Monitor, X } from "lucide-react";
import { kioskChoices } from "@/lib/kiosk-switch";
import { cn } from "@/lib/utils";

/**
 * Choix de la borne active sur cet appareil (ouvert par appui long) : numéro + libellé.
 * Rien n'est envoyé au serveur : la borne se souvient d'elle-même et adresse son propre terminal.
 */
export function KioskSwitchDialog({ config, current, onPick, onClose }: {
  config: unknown;
  current: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
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
