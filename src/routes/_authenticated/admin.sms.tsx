import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, Send, FlaskConical, Plus, Pause } from "lucide-react";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";
import { smsCampaignData, createSmsCampaign, sendSmsBatch, testSmsCampaign } from "@/lib/sms-campaign.functions";
import { smsDraftSchema, smsMetrics, smsPreview } from "@/lib/sms-campaign";

const initial = queryOptions({ queryKey: ["sms-campaigns", ""], queryFn: () => smsCampaignData({ data: {} }) });
export const Route = createFileRoute("/_authenticated/admin/sms")({
  head: () => ({ meta: [
    { title: "Campagnes SMS Brevo — LC Digitale" },
    { name: "description", content: "Campagnes SMS de la console agence : clients consentants, tests et envois par vagues." },
    { property: "og:title", content: "Campagnes SMS — Console agence LC Digitale" },
    { property: "og:description", content: "Préparer et suivre les campagnes SMS Brevo de chaque restaurant." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(initial), component: Page,
});
const states: Record<string, string> = { idle: "En attente", sending: "Envoi en cours", done: "Terminée", uncertain: "À vérifier dans Brevo" };
function Page() {
  const { data: base } = useSuspenseQuery(initial);
  const queryClient = useQueryClient();
  const load = useServerFn(smsCampaignData), create = useServerFn(createSmsCampaign), send = useServerFn(sendSmsBatch), test = useServerFn(testSmsCampaign);
  const [rid, setRid] = useState("");
  const { data, isFetching, error } = useQuery({ queryKey: ["sms-campaigns", rid], queryFn: () => load({ data: { restaurantId: rid } }), enabled: !!rid });
  const [name, setName] = useState(""), [sender, setSender] = useState(""), [body, setBody] = useState("");
  const [q, setQ] = useState(""), [selected, setSelected] = useState<string[]>([]), [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<"test" | "save" | string | null>(null);
  const [wave, setWave] = useState(100), [progress, setProgress] = useState(0);
  const customers = data?.customers ?? [], campaigns = data?.campaigns ?? [];
  const visible = customers.filter((c) => `${c.name ?? ""} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const metrics = smsMetrics(smsPreview(body));
  const draft = { restaurantId: rid, campaignId: "00000000-0000-4000-8000-000000000001", name, sender, body, customerIds: selected };
  const valid = smsDraftSchema.safeParse(draft).success;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sms-campaigns", rid] });
  async function action() {
    const current = confirm;
    if (!current) return;
    setConfirm(null); setBusy(true); setProgress(0);
    try {
      if (current === "test") {
        await test({ data: { restaurantId: rid, sender, body, phone } });
        toast.success("SMS test accepté par Brevo. Réception à vérifier sur le téléphone.");
      } else if (current === "save") {
        await create({ data: { ...draft, campaignId: crypto.randomUUID() } });
        toast.success("Campagne enregistrée, aucun SMS envoyé.");
      } else {
        let processed = 0;
        while (processed < wave) {
          const result = await send({ data: { campaignId: current, limit: Math.min(5, wave - processed) } });
          processed += result.processed; setProgress(processed);
          if (result.done || result.processed === 0) break;
        }
        toast.success("Vague terminée. Les envois acceptés sont suivis dans Brevo.");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible"); }
    finally { await refresh(); setBusy(false); }
  }
  const campaign = campaigns.find((c) => c.id === confirm);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
    <header className="flex items-center justify-between gap-3"><Crumbs page="Campagnes SMS" /><ThemeToggle /></header>
    <div className="flex items-center gap-3"><MessageSquare className="size-8 text-primary" /><h1 className="text-3xl font-semibold">Campagnes SMS</h1><span className="ml-auto text-sm text-muted-foreground">Brevo</span></div>
    <label className="block max-w-md space-y-2 text-sm font-medium">Restaurant
      <select aria-label="Restaurant" disabled={busy} className="h-12 w-full rounded-md border border-input bg-background px-3" value={rid} onChange={(e) => { setRid(e.target.value); setSelected([]); setQ(""); }}>
        <option value="">Choisir un restaurant</option>{base.restaurants.map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    {rid && <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Destinataires consentants</h2><span className="text-sm text-muted-foreground">{selected.length} sélectionné(s) / {customers.length}</span></div>
          <Input aria-label="Rechercher les clients" placeholder="Nom ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox disabled={busy || !visible.length} checked={!!visible.length && visible.every((c) => selected.includes(c.id))} onCheckedChange={(checked) => setSelected(checked ? [...new Set([...selected, ...visible.map((c) => c.id)])] : selected.filter((id) => !visible.some((c) => c.id === id)))} />Sélectionner les résultats</label>
          <div className="max-h-80 overflow-y-auto border-y border-border">
            {visible.map((c) => <label key={c.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 text-sm"><Checkbox checked={selected.includes(c.id)} disabled={busy} onCheckedChange={(checked) => setSelected(checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))} /><span className="min-w-0 flex-1"><span className="block break-words font-medium">{c.name || "Sans nom"}</span><span className="text-muted-foreground">{c.phone}</span></span><span className="text-xs text-muted-foreground">{c.consent_at ? new Date(c.consent_at).toLocaleDateString("fr-FR") : ""}</span></label>)}
            {!visible.length && <p className="py-6 text-sm text-muted-foreground">{isFetching ? "Chargement…" : "Aucun client consentant avec un téléphone valide."}</p>}
          </div>
        </section>
        <section className="min-w-0 space-y-4">
          <h2 className="text-xl font-semibold">Nouvelle campagne</h2>
          <label className="block space-y-1 text-sm font-medium">Nom de la campagne<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></label>
          <label className="block space-y-1 text-sm font-medium">Expéditeur (1–11 lettres ou chiffres)<Input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={11} placeholder="TacosHouse" /></label>
          <label className="block space-y-1 text-sm font-medium">Message<Textarea className="min-h-32" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Votre offre…" /></label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-live="polite"><span>{metrics.characters} caractères, STOP inclus</span><span>{metrics.segments} SMS / destinataire</span><span>{metrics.unicode ? "Unicode" : "GSM"}</span></div>
          <div className="rounded-md border border-border bg-muted p-4"><p className="whitespace-pre-wrap break-words text-sm">{smsPreview(body)}</p></div>
          <p className="text-sm text-muted-foreground">STOP obligatoire. SMS payants selon les crédits Brevo ; horaires marketing et désinscriptions appliqués par Brevo.</p>
          <div className="flex flex-wrap gap-2"><Input aria-label="Téléphone de test" className="min-w-0 flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tél. du restaurant ou de votre compte : +33…" /><Button variant="outline" className="min-h-11" disabled={busy || !smsDraftSchema.shape.sender.safeParse(sender).success || !smsDraftSchema.shape.body.safeParse(body).success || !phone} onClick={() => setConfirm("test")}><FlaskConical />Test</Button></div>
          <Button className="min-h-12 w-full" disabled={busy || !valid} onClick={() => setConfirm("save")}><Plus />Enregistrer la campagne</Button>
        </section>
      </div>
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto text-xl font-semibold">Campagnes et vagues</h2><label className="flex items-center gap-2 text-sm">Taille de vague<select aria-label="Taille de vague" disabled={busy} className="h-11 rounded-md border border-input bg-background px-3" value={wave} onChange={(e) => setWave(Number(e.target.value))}>{[100, 200, 300].map((n) => <option key={n} value={n}>{n} destinataires</option>)}</select></label></div>
        {busy && <p role="status" className="text-sm text-primary">Traitement en cours : {progress} / {wave}. Gardez cette page ouverte.</p>}
        {!campaigns.length && <p className="text-sm text-muted-foreground">Aucune campagne enregistrée.</p>}
        {campaigns.map((c) => <article className="space-y-3 rounded-lg border border-border bg-card p-4" key={c.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{c.name}</h3><p className="text-sm text-muted-foreground">{states[c.state]} · {c.sent} accepté(s) par Brevo · {c.skipped} exclu(s) · {c.remaining_ids.length} restant(s)</p></div><Button variant="outline" className="min-h-11" disabled={busy || c.state !== "idle" || !c.remaining_ids.length} onClick={() => setConfirm(c.id)}>{c.state === "uncertain" ? <Pause /> : <Send />}Envoyer une vague</Button></div>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.content.replace("[STOP_CODE]", "XXXXX")}</p>
          {c.error && <p className="break-words text-sm text-destructive" role="alert">{c.error}</p>}
        </article>)}
      </section>
    </>}
    <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{confirm === "test" ? "Envoyer un SMS test ?" : confirm === "save" ? "Enregistrer cette campagne ?" : "Envoyer cette vague ?"}</DialogTitle><DialogDescription>{confirm === "test" ? `Un SMS payant sera envoyé uniquement au ${phone}.` : confirm === "save" ? `${selected.length} destinataire(s). Le contenu sera figé ; aucun envoi maintenant.` : `${Math.min(wave, campaign?.remaining_ids.length ?? 0)} destinataire(s) au maximum. Consentement et désinscription revérifiés. Coût selon Brevo ; aucun envoi automatique des vagues suivantes.`}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>Annuler</Button><Button onClick={action}>{confirm === "save" ? "Enregistrer" : "Confirmer l’envoi"}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}