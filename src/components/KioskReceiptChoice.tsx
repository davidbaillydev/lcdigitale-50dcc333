import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReceiptState = "choice" | "printing" | "printed" | "failed";

/** Choix tactile du client : aucune impression sans son accord explicite. */
export function KioskReceiptChoice({ onPrint, onFinish }: { onPrint: () => Promise<boolean>; onFinish: () => void }) {
  const [state, setState] = useState<ReceiptState>("choice");
  const inFlight = useRef(false);

  const print = async () => {
    if (inFlight.current || state === "printed") return;
    inFlight.current = true;
    setState("printing");
    const printed = await onPrint().catch(() => false);
    setState(printed ? "printed" : "failed");
    inFlight.current = false;
  };

  if (state === "printed") {
    return (
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <p role="status" className="text-2xl font-semibold text-primary">Imprimé — envoi confirmé à l’imprimante.</p>
        <p className="text-lg text-muted-foreground">Vérifiez la sortie du papier.</p>
        <Button onClick={onFinish} className="h-auto w-full px-8 py-5 font-display text-3xl">Terminer</Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <p className="flex items-center gap-3 font-display text-4xl"><Printer className="h-9 w-9 text-primary" />Souhaitez-vous votre ticket ?</p>
      {state === "failed" && <p role="alert" className="text-xl text-destructive">Le ticket n’a pas pu être imprimé. Consultez la file de cette tablette pour réessayer. Conservez votre numéro de commande.</p>}
      <div className="grid w-full grid-cols-2 gap-4">
        <Button onClick={print} disabled={state === "printing"} className="h-auto whitespace-normal px-6 py-6 font-display text-3xl">
          {state === "printing" ? "Impression…" : state === "failed" ? "Réessayer" : "Oui, imprimer"}
        </Button>
        <Button variant="secondary" onClick={onFinish} disabled={state === "printing"} className="h-auto whitespace-normal px-6 py-6 font-display text-3xl">
          {state === "failed" ? "Terminer" : "Non, merci"}
        </Button>
      </div>
    </div>
  );
}
