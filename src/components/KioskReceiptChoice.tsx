import { useState } from "react";
import { Printer } from "lucide-react";

type ReceiptState = "choice" | "printing" | "printed" | "failed";

/** Choix tactile du client : aucune impression sans son accord explicite. */
export function KioskReceiptChoice({ onPrint, onFinish }: { onPrint: () => Promise<boolean>; onFinish: () => void }) {
  const [state, setState] = useState<ReceiptState>("choice");

  const print = async () => {
    if (state === "printing" || state === "printed") return;
    setState("printing");
    const printed = await onPrint().catch(() => false);
    setState(printed ? "printed" : "failed");
  };

  if (state === "printed") {
    return (
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <p role="status" className="text-2xl font-semibold text-primary">Votre ticket est en cours d’impression.</p>
        <button onClick={onFinish} className="w-full rounded-2xl bg-primary px-8 py-5 font-display text-3xl text-primary-foreground">Terminer</button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <p className="flex items-center gap-3 font-display text-4xl"><Printer className="h-9 w-9 text-primary" />Souhaitez-vous votre ticket ?</p>
      {state === "failed" && <p role="alert" className="text-xl text-destructive">Le ticket n’a pas pu être imprimé. Conservez votre numéro de commande.</p>}
      <div className="grid w-full grid-cols-2 gap-4">
        <button onClick={print} disabled={state === "printing"} className="rounded-2xl bg-primary px-6 py-6 font-display text-3xl text-primary-foreground disabled:opacity-50">
          {state === "printing" ? "Impression…" : state === "failed" ? "Réessayer" : "Oui, imprimer"}
        </button>
        <button onClick={onFinish} disabled={state === "printing"} className="rounded-2xl bg-muted px-6 py-6 font-display text-3xl disabled:opacity-50">
          {state === "failed" ? "Terminer" : "Non, merci"}
        </button>
      </div>
    </div>
  );
}
