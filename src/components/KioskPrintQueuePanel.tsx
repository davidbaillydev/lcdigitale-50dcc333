import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KioskPrintJob } from "@/lib/kiosk-print-queue";

const labels = { waiting: "En attente", printing: "Impression…", printed: "Imprimé", failed: "Échec" };
/** File locale des tickets — affichée uniquement dans le panneau personnel (après code PIN). */
export function KioskPrintQueuePanel({ jobs, onRetry, error }: { jobs: KioskPrintJob[]; onRetry: (key: string) => void; error?: string | null }) {
  const pending = jobs.filter((j) => j.state !== "printed").length;
  return <section aria-label="File locale des tickets" className="mt-8 flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-5">
    <p className="text-2xl font-semibold">Tickets de cette tablette · <span>{pending} en attente</span></p>
    <p className="text-lg text-muted-foreground">File locale, non partagée entre les tablettes. « Imprimé » confirme l’envoi, pas la sortie du papier.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!jobs.length && <p>Aucun ticket en file.</p>}
    {[...jobs].reverse().map((j) => <div key={j.key} className="border-t border-border py-3">
      <p className="text-xl font-semibold">Commande {j.order.order_number} · {j.kiosk.id ? `Borne ${j.kiosk.id}` : "Cette tablette"}</p>
      <p role="status" className={j.state === "failed" ? "text-destructive" : "text-primary"}>{labels[j.state]}</p>
      {j.error && <p className="my-2 text-sm text-muted-foreground">{j.error}</p>}
      {(j.state === "failed" || j.state === "waiting") && <Button variant="outline" onClick={() => onRetry(j.key)} className="mt-2 h-12 px-5"><RotateCcw />Réessayer</Button>}
    </div>)}
  </section>;
}
