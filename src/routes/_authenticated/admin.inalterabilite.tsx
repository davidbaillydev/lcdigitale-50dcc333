import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, FileText, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Crumbs } from "@/components/Crumbs";
import { ThemeToggle } from "@/lib/theme";
import { listAgencyRestaurants } from "@/lib/agency.functions";
import { createPosFiscalArchive, downloadPosFiscalArchive, getPosFiscalOverview } from "@/lib/pos-fiscal.functions";
import { attestationDraft, BOFIP_ATTESTATION_URL } from "@/lib/pos-attestation";

const restaurantsOptions = queryOptions({ queryKey: ["agency-fiscal-restaurants"], queryFn: () => listAgencyRestaurants() });
export const Route = createFileRoute("/_authenticated/admin/inalterabilite")({
  head: () => ({ meta: [
    { title: "Inaltérabilité caisse & archives — LC Digitale" },
    { name: "description", content: "Console agence : vérification du chaînage des tickets, journal technique et archives de caisse." },
    { property: "og:title", content: "Inaltérabilité caisse — LC Digitale" },
    { property: "og:description", content: "Journal technique, empreintes SHA-256 et dossier individuel éditeur en cours de validation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(restaurantsOptions),
  component: Page,
});
const labels: Record<string, string> = { sale: "Vente encaissée", discount: "Remise", open_session: "Ouverture caisse", close_z: "Clôture Z", void: "Annulation", cash_in: "Entrée espèces", cash_out: "Sortie espèces", configuration_change: "Configuration modifiée", integrity_error: "Anomalie d’intégrité", archive_created: "Archive créée" };
function saveFile(content: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Page() {
  const { data: restaurants } = useSuspenseQuery(restaurantsOptions);
  const [selected, setSelected] = useState("");
  const restaurantId = selected || restaurants[0]?.id || "";
  const read = useServerFn(getPosFiscalOverview), archive = useServerFn(createPosFiscalArchive), download = useServerFn(downloadPosFiscalArchive);
  const { data, error, isFetching, refetch } = useQuery({ queryKey: ["pos-fiscal", restaurantId], queryFn: () => read({ data: { restaurantId } }), enabled: !!restaurantId, retry: false });
  const [busy, setBusy] = useState(false), [fingerprint, setFingerprint] = useState<string | null>(null);
  const exportArchive = async (archiveId?: string) => {
    setBusy(true);
    try {
      const result = archiveId ? await download({ data: { restaurantId, archiveId } }) : await archive({ data: { restaurantId } });
      saveFile(result.content, result.filename); saveFile(`${result.hash}  ${result.filename}\n`, `${result.filename}.sha256`, "text/plain");
      setFingerprint(result.hash); await refetch(); toast.success("Archive et empreinte téléchargées");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export impossible"); } finally { setBusy(false); }
  };
  const exportDraft = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf"); const doc = new jsPDF(); let y = 20;
      doc.setFontSize(10);
      for (const paragraph of attestationDraft(data.restaurant)) {
        const lines = doc.splitTextToSize(paragraph.replaceAll("—", "-"), 174) as string[];
        for (const line of lines) { if (y > 275) { doc.addPage(); y = 20; } doc.text(line, 18, y); y += 5; } y += 5;
      }
      doc.save(`projet-attestation-non-signe-${data.restaurant.slug}.pdf`);
    } catch { toast.error("Document indisponible"); } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div className="flex items-center justify-between"><Crumbs page="Inaltérabilité caisse" /><ThemeToggle /></div>
    <header className="flex flex-wrap items-center gap-4"><div className="mr-auto"><p className="text-sm font-semibold text-primary">Console agence · caisse comptoir</p><h1 className="mt-2 text-4xl sm:text-5xl">Inaltérabilité caisse</h1></div><Button variant="outline" className="min-h-12" disabled={isFetching || !restaurantId} onClick={() => void refetch()}><RefreshCw />Vérifier</Button></header>
    <p className="border-l-4 border-primary pl-4 text-sm text-muted-foreground">Conformité fiscale non établie. Le chaînage SHA-256 ne vaut ni certification ni attestation éditeur signée ; date certaine, conservation sécurisée externe et clôtures périodiques restent à valider.</p>
    <label className="block max-w-md text-sm">Restaurant<select aria-label="Restaurant" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-foreground" value={restaurantId} onChange={(e) => { setSelected(e.target.value); setFingerprint(null); }} >{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {error && <p role="alert" className="text-destructive">{error instanceof Error ? error.message : "Lecture impossible"}</p>}
    {data && <>
      <section className="grid gap-4 border-y py-5 sm:grid-cols-3">{[["Tickets chaînés", data.receiptCount], ["Événements techniques", data.eventCount], ["Tickets antérieurs non chaînés", data.legacyCount]].map(([label, value]) => <div key={String(label)}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p></div>)}</section>
      <p className={`flex items-center gap-2 font-medium ${data.valid ? "text-primary" : "text-destructive"}`}><ShieldCheck />{data.valid ? "Empreintes cohérentes au dernier contrôle" : "Anomalie détectée — export bloqué"}</p>
      <p className="text-sm text-muted-foreground">Début du chaînage : {data.head ? new Date(data.head.starts_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "Aucun événement enregistré"}. L’historique antérieur reste conservé, sans certification rétroactive.</p>
      <div className="flex flex-wrap gap-3"><Button className="min-h-12" disabled={busy || !data.valid} onClick={() => void exportArchive()}><Download />Exporter l’archive technique</Button><Button variant="outline" className="min-h-12" disabled={busy} onClick={() => void exportDraft()}><FileText />Projet d’attestation · non signé</Button><Button asChild variant="ghost" className="min-h-12"><a href={BOFIP_ATTESTATION_URL} target="_blank" rel="noreferrer">Modèle officiel BOFiP</a></Button></div>
      {fingerprint && <p className="break-all border-y py-3 font-mono text-xs">SHA-256 : {fingerprint}</p>}
      <section><h2 className="text-2xl">Archives conservées</h2><div className="mt-3 divide-y border-y">{data.archives.map((a) => <div key={a.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p>{new Date(a.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p><p className="break-all font-mono text-xs text-muted-foreground">{a.hash}</p></div><Button variant="outline" className="min-h-12" disabled={busy} aria-label="Télécharger cette archive" onClick={() => void exportArchive(a.id)}><Download />Télécharger</Button></div>)}{!data.archives.length && <p className="py-5 text-muted-foreground">Aucune archive enregistrée.</p>}</div></section>
      <section><h2 className="text-2xl">Journal des événements techniques</h2><p className="mt-1 text-sm text-muted-foreground">100 derniers événements ; journal complet dans l’archive.</p><div className="mt-3 divide-y border-y">{data.jet.map((j) => <div key={j.id} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]"><p className="text-sm text-muted-foreground">{new Date(j.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p><div className="min-w-0"><p className="font-medium">{labels[j.event_type] || j.event_type}</p><p className="break-all font-mono text-xs text-muted-foreground">{j.hash}</p>{j.actor_id && <p className="break-all text-xs text-muted-foreground">Responsable : {j.actor_id}</p>}</div></div>)}{!data.jet.length && <p className="py-5 text-muted-foreground">Aucun événement enregistré.</p>}</div></section>
    </>}
  </main>;
}