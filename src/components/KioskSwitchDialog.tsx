import { useState } from "react";
import { Lock, Monitor, RotateCcw, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { verifyKioskSwitchPin } from "@/lib/kitchen-pin.functions";
import { kioskChoices } from "@/lib/kiosk-switch";
import { cn } from "@/lib/utils";
import { PrinterSetup } from "@/components/PrinterSetup";
import type { TicketShop } from "@/lib/ticket";
import { KioskPrintQueuePanel } from "@/components/KioskPrintQueuePanel";
import type { KioskPrintJob } from "@/lib/kiosk-print-queue";
import { Button } from "@/components/ui/button";

type PrintQueueProps = { jobs: KioskPrintJob[]; onRetry: (key: string) => void; error?: string | null };

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
  shop: TicketShop;
  printQueue?: PrintQueueProps;
  onReset?: () => void;
  resetDisabled?: boolean;
}) {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <KioskPinGate restaurantId={props.restaurantId} onClose={props.onClose} onOk={() => setUnlocked(true)} />;
  return <Switcher {...props} />;
}

const MSG = { wrong: "Code incorrect", locked: "Trop d'essais : réessayez dans 5 minutes", no_pin: "Aucun code PIN des bornes n'est défini : demandez à l'agence de le configurer.", error: "Vérification impossible, réessayez" };

/** Verrou : le code PIN cuisine du restaurant est vérifié côté serveur avant d'afficher le sélecteur. */
export function KioskPinGate({ restaurantId, onOk, onClose }: { restaurantId: string; onOk: () => void | Promise<void>; onClose: () => void }) {
  const verify = useServerFn(verifyKioskSwitchPin);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await verify({ data: { restaurantId, pin } });
      if (r.ok) await onOk(); else { setErr(MSG[r.reason ?? "wrong"]); setPin(""); }
    } catch { setErr(MSG.error); setPin(""); }
    setBusy(false);
  };
  const press = (d: string) => { setErr(null); setPin((p) => (p.length < 6 ? p + d : p)); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Code personnel" className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-background p-5 sm:p-8">
      <div className="flex justify-end"><Button variant="ghost" disabled={busy} onClick={onClose} aria-label="Fermer" className="size-12"><X className="size-6" /></Button></div>
      <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 py-4 short:gap-3">
      <p className="flex items-center gap-3 text-center text-2xl font-semibold"><Lock className="size-7 shrink-0 text-primary" />Réservé au personnel</p>
      <p className="text-center text-base text-muted-foreground">Code PIN des bornes du restaurant</p>
      <input aria-label="Code PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={busy} onChange={(e) => { setErr(null); setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); }} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} className="h-14 w-full rounded-lg border border-input bg-card px-4 text-center text-3xl" />
      {err && <p role="alert" className="text-center text-base font-semibold text-destructive">{err}</p>}
      <div className="grid w-full grid-cols-3 gap-3 short:gap-2">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <Button key={d} variant="outline" disabled={busy} onClick={() => press(d)} className="h-16 rounded-lg text-2xl font-semibold short:h-14">{d}</Button>
        ))}
        <Button variant="secondary" disabled={busy} onClick={() => setPin((p) => p.slice(0, -1))} className="h-16 rounded-lg text-base short:h-14">Effacer</Button>
        <Button variant="outline" disabled={busy} onClick={() => press("0")} className="h-16 rounded-lg text-2xl font-semibold short:h-14">0</Button>
        <Button onClick={() => void submit()} disabled={pin.length < 4 || busy} className="h-16 rounded-lg text-base font-semibold short:h-14">{busy ? "Patientez…" : "Valider"}</Button>
      </div>
      </div>
    </div>
  );
}

function Switcher({ config, current, onPick, onClose, shop, printQueue, onReset, resetDisabled }: { config: unknown; current: string | null; onPick: (id: string | null) => void; onClose: () => void; shop: TicketShop; printQueue?: PrintQueueProps; onReset?: () => void; resetDisabled?: boolean }) {
  const [other, setOther] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
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
        <section className="mt-8 rounded-2xl border-2 border-border bg-card p-5">
          <p className="text-2xl font-semibold">Imprimante de la borne</p>
          <p className="mb-3 text-lg text-muted-foreground">Séparée de l'imprimante cuisine/caisse. À la fin de sa commande, le client choisit s'il souhaite imprimer son ticket.</p>
          <PrinterSetup shop={shop} width={80} compact scope="kiosk" />
        </section>
        {printQueue && <KioskPrintQueuePanel {...printQueue} />}
        {onReset && <div className="mt-6 border-t border-border pt-5"><Button variant="outline" disabled={resetDisabled} onClick={() => setConfirmReset(true)} className="h-auto min-h-14 whitespace-normal text-lg"><RotateCcw />Changer de restaurant / réinitialiser</Button>{resetDisabled && <p className="mt-2 text-muted-foreground">Terminez le paiement en cours avant de changer la configuration.</p>}</div>}
      </div>
      {confirmReset && <div role="dialog" aria-modal="true" aria-label="Réinitialiser cette borne" className="absolute inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-background/95 p-5"><div className="w-full max-w-lg space-y-5 rounded-lg border border-border bg-card p-6"><h2 className="text-2xl font-semibold">Réinitialiser cette borne ?</h2><p className="text-muted-foreground">Le restaurant et le numéro mémorisés seront oubliés sur cette tablette. Vous devrez choisir un restaurant et saisir son code PIN. Les licences, commandes, réglages d’imprimante et tickets en attente sont conservés.</p><div className="flex flex-wrap justify-end gap-3"><Button variant="outline" className="h-12" onClick={() => setConfirmReset(false)}>Annuler</Button><Button className="h-12" disabled={resetDisabled} onClick={onReset}>Réinitialiser</Button></div></div></div>}
      <div className="mt-6 flex gap-4">
        {current && <button onClick={() => onPick(null)} className="flex-1 rounded-2xl bg-muted py-6 text-2xl font-semibold">Retirer le numéro</button>}
        <button onClick={onClose} className="flex-1 rounded-2xl bg-primary py-6 text-2xl font-semibold text-primary-foreground">Terminé</button>
      </div>
    </div>
  );
}
