import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { getKioskAudit } from "@/lib/kiosk-licenses.functions";

type Props = { data: Awaited<ReturnType<typeof getKioskAudit>>; page: number; onPage: (page: number) => void };
export function KioskAuditJournal({ data, page, onPage }: Props) {
  return <section aria-label="Journal des bornes" className="space-y-4 border-t pt-6">
    <div className="flex flex-wrap items-center gap-3"><History className="size-5 text-primary" /><h2 className="mr-auto text-2xl">Journal des bornes</h2><span className="text-sm text-muted-foreground">{data.total} événement{data.total > 1 ? "s" : ""}</span></div>
    <div className="divide-y border-y">{data.rows.map((row) => <article key={row.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><p className="break-words font-semibold">{row.restaurant_name}</p><p className="break-words text-sm text-muted-foreground">{row.kiosk_label} · Borne {row.kiosk_id}</p></div>
      <div className="min-w-0"><p className="break-all text-sm">{row.actor_email || (row.actor_user_id ? `Utilisateur ${row.actor_user_id}` : "Système / intervention technique")}</p><time dateTime={row.occurred_at} className="text-xs text-muted-foreground">{new Date(row.occurred_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "medium" })} · Paris</time></div>
      <Badge variant="outline" className={`w-fit ${row.active ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{row.active ? "Activation" : "Suspension"}</Badge>
    </article>)}{!data.rows.length && <p className="py-8 text-sm text-muted-foreground">Aucun changement enregistré pour ce restaurant.</p>}</div>
    <div className="flex items-center justify-end gap-3"><Button variant="outline" size="icon" className="size-12" aria-label="Événements précédents" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft /></Button><span className="text-sm tabular-nums">Page {page + 1} / {Math.max(1, Math.ceil(data.total / 20))}</span><Button variant="outline" size="icon" className="size-12" aria-label="Événements suivants" disabled={(page + 1) * 20 >= data.total} onClick={() => onPage(page + 1)}><ChevronRight /></Button></div>
  </section>;
}