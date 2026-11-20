import { useState } from "react";
import { AlertCircle, Building2, ChevronDown, ChevronUp, MapPin, Pencil, Plus, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BrandLogo } from "@/lib/brand";
import { kioskRestaurantRows, type KioskDashboardData } from "@/lib/kiosk-dashboard";

type Props = { data: KioskDashboardData; search: string; unpaidOnly: boolean; restaurantId: string; busy: string | null; overrides: Record<string, boolean>; onToggle: (restaurantId: string, kioskId: string, active: boolean) => void; onAdd: (restaurantId: string) => void; onEdit: (licenseId: string) => void; onBilling: (licenseId: string) => void };
const date = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("fr-FR");
export function KioskLicenseDashboard({ data, search, unpaidOnly, restaurantId, busy, overrides, onToggle, onAdd, onEdit, onBilling }: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const needle = search.trim().toLocaleLowerCase("fr");
  const rows = kioskRestaurantRows(data).filter(({ restaurant, unpaid }) => (restaurantId === "all" || restaurant.id === restaurantId) && (!unpaidOnly || unpaid > 0) && `${restaurant.name} ${restaurant.city ?? ""}`.toLocaleLowerCase("fr").includes(needle));
  return <section aria-label="Bornes par restaurant" className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Restaurants <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span></h2><span className="text-sm text-muted-foreground">{rows.reduce((n, r) => n + (unpaidOnly ? r.unpaid : r.kiosks.length), 0)} bornes{unpaidOnly ? " impayées" : ""}</span></div>
    {rows.map(({ restaurant: r, kiosks, unpaid }) => <article key={r.id} className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3 p-4 sm:p-5">
        {r.logo_url ? <BrandLogo src={r.logo_url} name={r.name} className="size-12 shrink-0 object-contain" /> : <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-6" /></div>}
        <div className="min-w-0 flex-1"><h3 className="break-words text-lg font-semibold">{r.name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{r.city || "Ville non renseignée"} · {kiosks.length} borne{kiosks.length > 1 ? "s" : ""}</p></div>
        <Button variant="ghost" size="icon" className="size-12" aria-label={`${closed[r.id] ? "Afficher" : "Masquer"} les bornes de ${r.name}`} aria-expanded={!closed[r.id]} onClick={() => setClosed((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}>{closed[r.id] ? <ChevronDown /> : <ChevronUp />}</Button>
        <div className="col-span-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className={r.active ? "border-success/30 text-success" : "text-muted-foreground"}>{r.active ? "Restaurant actif" : "Restaurant hors ligne"}</Badge>{unpaid > 0 && <Badge variant="outline" className="gap-1 border-destructive/25 bg-destructive/10 text-destructive"><AlertCircle className="size-3.5" />{unpaid} impayée{unpaid > 1 ? "s" : ""}</Badge>}</div>
      </div>
      {!closed[r.id] && <div id={`kiosks-${r.id}`} className="border-t">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground lg:grid"><span>BORNE / LICENCE</span><span>RÈGLEMENT</span><span>ÉCHÉANCE</span><span>ÉTAT & ACTIONS</span></div>
        <div className="divide-y">{kiosks.filter((k) => !unpaidOnly || k.payment.status === "invoiced").map((k) => {
          const key = `${r.id}:${k.id}`, active = overrides[key] ?? k.active;
          return <div key={k.id} className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
            <div className="flex min-w-0 items-start gap-3"><Tablet className="mt-1 size-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="break-words font-semibold">{k.label}</p><p className="mt-1 text-xs text-muted-foreground">Identifiant borne : {k.id}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{k.license ? `Licence ${k.license.id}` : "Aucune licence associée"}</p>{k.license && k.license.status !== "active" && <Badge variant="outline" className="mt-2">Licence {k.license.status === "ended" ? "terminée" : "suspendue"}</Badge>}</div></div>
            <div><Badge variant="outline" className={k.payment.status === "paid" ? "border-success/30 bg-success/10 text-success" : k.payment.status === "invoiced" ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}><span className="mr-1.5 size-1.5 rounded-full bg-current" />{k.payment.label}</Badge><p className="mt-2 text-xs text-muted-foreground">{k.license ? "400 € HT / an" : "Licence à créer"}</p></div>
            <div><p className="text-xs text-muted-foreground lg:hidden">Échéance</p><p className="text-sm tabular-nums">{k.payment.due ? date(k.payment.due) : "—"}</p>{k.license && <Button variant="link" className="h-auto min-h-9 px-0 text-xs" onClick={() => onBilling(k.license?.id ?? "")}>Suivi du règlement</Button>}</div>
            <div className="flex flex-wrap items-center gap-3"><label className="flex min-h-12 cursor-pointer items-center gap-3"><Switch aria-label={`${active ? "Suspendre" : "Réactiver"} ${k.label} — ${r.name}`} checked={active} disabled={!k.declared || busy !== null} onCheckedChange={(v) => onToggle(r.id, k.id, v)} /><span aria-live="polite" className={`text-sm font-medium ${active ? "text-success" : "text-muted-foreground"}`}>{!k.declared ? "Non déclarée" : active ? "En service" : "Suspendue"}</span></label>{k.license && <Button size="icon" variant="ghost" className="size-11" title="Modifier la licence" aria-label={`Modifier la licence de ${k.label} — ${r.name}`} onClick={() => onEdit(k.license?.id ?? "")}><Pencil className="size-4" /></Button>}</div>
          </div>;
        })}</div>
        {!kiosks.length && <p className="px-5 py-6 text-sm text-muted-foreground">Aucune borne déclarée.</p>}
        <div className="border-t bg-muted/20 px-4 py-2"><Button variant="ghost" className="min-h-12 text-primary" onClick={() => onAdd(r.id)}><Plus className="size-4" />Ajouter une borne</Button></div>
      </div>}
    </article>)}
    {!rows.length && <div className="border-y py-12 text-center"><Tablet className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">Aucun restaurant correspondant</h3><p className="mt-2 text-sm text-muted-foreground">Essayez un autre filtre ou une autre recherche.</p></div>}
  </section>;
}