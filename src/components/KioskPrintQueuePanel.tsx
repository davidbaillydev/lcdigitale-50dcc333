import { useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KioskPrintJob } from "@/lib/kiosk-print-queue";

const labels = { waiting: "En attente", printing: "Impression…", printed: "Imprimé", failed: "Échec" };
export function KioskPrintQueuePanel({ jobs, onRetry, error }: { jobs: KioskPrintJob[]; onRetry: (key: string) => void; error?: string | null }) {
  const [open, setOpen] = useState(false);
  const pending = jobs.filter((j) => j.state !== "printed").length;
  return <div className="absolute bottom-4 left-4 z-[65] max-w-[calc(100%-2rem)]">
    <Button variant={pending || error ? "default" : "secondary"} onClick={() => setOpen(!open)} aria-expanded={open} className="h-14 px-5 text-lg">
      <Printer /> Tickets <span className="font-bold">{pending}</span> en attente
    </Button>
    {open && <section aria-label="File locale des tickets" className="absolute bottom-16 left-0 flex max-h-[65vh] w-[30rem] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-lg">
      <h2 className="text-2xl font-bold">Tickets de cette tablette</h2>
      <p className="text-muted-foreground">File locale, non partagée entre les tablettes. « Imprimé » confirme l’envoi, pas la sortie du papier.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!jobs.length && <p>Aucun ticket en file.</p>}
      {[...jobs].reverse().map((j) => <div key={j.key} className="border-t border-border py-3">
        <p className="text-xl font-semibold">Commande {j.order.order_number} · {j.kiosk.id ? `Borne ${j.kiosk.id}` : "Cette tablette"}</p>
        <p role="status" className={j.state === "failed" ? "text-destructive" : "text-primary"}>{labels[j.state]}</p>
        {j.error && <p className="my-2 text-sm text-muted-foreground">{j.error}</p>}
        {(j.state === "failed" || j.state === "waiting") && <Button variant="outline" onClick={() => onRetry(j.key)} className="mt-2 h-12 px-5"><RotateCcw />Réessayer</Button>}
      </div>)}
    </section>}
  </div>;
}