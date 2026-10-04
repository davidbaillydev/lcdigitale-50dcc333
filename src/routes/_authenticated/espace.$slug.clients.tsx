import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { downloadCSV, downloadXLSX, eur, readSheet } from "@/lib/export";
import { normEmail, normPhone, parseImport, type ImportRow } from "@/lib/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/lib/theme";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { sendCampaign } from "@/lib/campaign.functions";

export const Route = createFileRoute("/_authenticated/espace/$slug/clients")({
  head: () => ({
    meta: [
      { title: "Clients du restaurant — LC Digitale" },
      { name: "description", content: "Fichier clients, import, consentement RGPD et ciblage marketing." },
      { property: "og:title", content: "Clients du restaurant" },
      { property: "og:description", content: "Fichier clients et consentement marketing." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Customer = { id: string; name: string | null; email: string | null; phone: string | null; marketing_consent: boolean; consent_at: string | null; consent_source: string | null; source: string; created_at: string };
type Stats = { orders: number; spent: number; last: string | null };
const SRC: Record<string, string> = { import: "Import", order: "Commande", manual: "Manuel" };

function Page() {
  const { slug } = Route.useParams();
  const { loading, restaurants } = useStaff();
  const r = restaurants.find((x) => x.slug === slug);
  const rid = r?.id;
  const canManage = r && r.role !== "kitchen";

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["customers", rid], enabled: !!rid && !!canManage,
    queryFn: async () => {
      const customers: Customer[] = [];
      for (let i = 0; ; i += 1000) {
        const { data: c, error } = await supabase.from("restaurant_customers").select("id, name, email, phone, marketing_consent, consent_at, consent_source, source, created_at").eq("restaurant_id", rid!).order("created_at", { ascending: false }).range(i, i + 999);
        if (error) throw error;
        customers.push(...(c ?? []));
        if (!c || c.length < 1000) break;
      }
      const orders: { customer_name: string; email: string | null; phone: string; total: number; created_at: string }[] = [];
      for (let i = 0; ; i += 1000) {
        const { data: o } = await supabase.from("orders").select("customer_name, email, phone, total, created_at").eq("restaurant_id", rid!).not("status", "in", "(awaiting_payment,cancelled)").range(i, i + 999);
        orders.push(...((o ?? []) as typeof orders));
        if (!o || o.length < 1000) break;
      }
      return { customers, orders };
    },
  });

  const stats = useMemo(() => {
    const m = new Map<string, Stats>();
    (data?.orders ?? []).forEach((o) => {
      for (const k of [normEmail(o.email) && `e:${normEmail(o.email)}`, normPhone(o.phone) && `p:${normPhone(o.phone)}`]) {
        if (!k) continue;
        const s = m.get(k) ?? { orders: 0, spent: 0, last: null };
        s.orders++; s.spent += Number(o.total); if (!s.last || o.created_at > s.last) s.last = o.created_at;
        m.set(k, s);
      }
    });
    return (c: Customer): Stats => (c.email && m.get(`e:${c.email}`)) || (c.phone && m.get(`p:${c.phone}`)) || { orders: 0, spent: 0, last: null };
  }, [data]);

  // Ciblage
  const [q, setQ] = useState("");
  const [consentOnly, setConsentOnly] = useState(false);
  const [minOrders, setMinOrders] = useState(0);
  const [minSpent, setMinSpent] = useState(0);
  const [inactive, setInactive] = useState(0);
  const [needEmail, setNeedEmail] = useState(false);
  const rows = useMemo(() => (data?.customers ?? []).filter((c) => {
    const s = stats(c);
    if (q && !`${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (consentOnly && !c.marketing_consent) return false;
    if (needEmail && !c.email) return false;
    if (s.orders < minOrders || s.spent < minSpent) return false;
    if (inactive > 0 && s.last && Date.now() - new Date(s.last).getTime() < inactive * 864e5) return false;
    return true;
  }), [data, stats, q, consentOnly, minOrders, minSpent, inactive, needEmail]);

  const exportRows = (list: Customer[]) => list.map((c) => { const s = stats(c); return { Nom: c.name ?? "", Email: c.email ?? "", Téléphone: c.phone ?? "", "Consentement marketing": c.marketing_consent ? "Oui" : "Non", "Date consentement": c.consent_at ? new Date(c.consent_at).toLocaleDateString("fr-FR") : "", Origine: SRC[c.source] ?? c.source, Commandes: s.orders, "Total dépensé (€)": Math.round(s.spent * 100) / 100, "Dernière commande": s.last ? new Date(s.last).toLocaleDateString("fr-FR") : "" }; });

  const setConsent = async (c: Customer, v: boolean) => {
    const { error } = await supabase.from("restaurant_customers").update({ marketing_consent: v, consent_at: v ? new Date().toISOString() : null, consent_source: v ? "manuel (gérant)" : null }).eq("id", c.id);
    if (error) toast.error(error.message); else refetch();
  };
  const erase = async (c: Customer) => {
    if (!confirm(`Supprimer définitivement la fiche de ${c.name ?? c.email ?? c.phone} ? (droit à l'effacement RGPD)`)) return;
    const { error } = await supabase.from("restaurant_customers").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Fiche supprimée"); refetch(); }
  };

  const syncFromOrders = async () => {
    const existing = data?.customers ?? [];
    const known = new Set(existing.flatMap((c) => [c.email && `e:${c.email}`, c.phone && `p:${c.phone}`].filter(Boolean) as string[]));
    const add: ImportRow[] = [];
    (data?.orders ?? []).forEach((o) => {
      const email = normEmail(o.email), phone = normPhone(o.phone);
      const keys = [email && `e:${email}`, phone && `p:${phone}`].filter(Boolean) as string[];
      if (!keys.length || keys.some((k) => known.has(k))) return;
      keys.forEach((k) => known.add(k));
      add.push({ name: o.customer_name, email, phone, consent: false });
    });
    if (!add.length) { toast.info("Tous les clients des commandes sont déjà dans le fichier."); return; }
    const { error } = await insertChunks(rid!, add, "order", false);
    if (error) toast.error(error); else { toast.success(`${add.length} client(s) ajouté(s) depuis les commandes`); refetch(); }
  };

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant du restaurant et à l'agence.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-2"><Button asChild variant="ghost"><Link to="/espace/$slug" params={{ slug }}><ArrowLeft /> Écran cuisine</Link></Button><span className="mr-auto" /><ThemeToggle /></div>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-5xl">Clients {r.name}</h1>
        <Button variant="secondary" onClick={syncFromOrders} disabled={!data}><RefreshCw /> Ajouter les clients des commandes</Button>
      </div>

      <ImportPanel restaurantId={r.id} existing={data?.customers ?? []} onDone={() => refetch()} />

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-2xl">Ciblage des emails marketing</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Rechercher nom, email, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="text-sm">Commandes minimum<Input type="number" min={0} value={minOrders} onChange={(e) => setMinOrders(Number(e.target.value))} /></label>
          <label className="text-sm">Dépensé minimum (€)<Input type="number" min={0} value={minSpent} onChange={(e) => setMinSpent(Number(e.target.value))} /></label>
          <label className="text-sm">Sans commande depuis (jours, 0 = ignorer)<Input type="number" min={0} value={inactive} onChange={(e) => setInactive(Number(e.target.value))} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><Switch checked={consentOnly} onCheckedChange={setConsentOnly} /> Consentement marketing uniquement</label>
          <label className="flex items-center gap-2"><Switch checked={needEmail} onCheckedChange={setNeedEmail} /> Avec email</label>
          <span className="ml-auto font-semibold">{rows.length} client(s) sur {data?.customers.length ?? 0}</span>
          <Button size="sm" variant="secondary" onClick={() => downloadCSV(`clients-${slug}`, exportRows(rows))}><FileDown /> CSV</Button>
          <Button size="sm" variant="secondary" onClick={() => downloadXLSX(`clients-${slug}`, { Clients: exportRows(rows) })}><FileSpreadsheet /> Excel</Button>
          <Button size="sm" onClick={() => {
            const list = rows.filter((c) => c.marketing_consent && c.email);
            if (!list.length) { toast.error("Aucun client ciblé n'a donné son consentement avec un email."); return; }
            downloadCSV(`liste-diffusion-${slug}`, list.map((c) => ({ email: c.email, nom: c.name ?? "", consentement: c.consent_at ?? "" })));
            toast.success(`${list.length} contact(s) consentant(s) exporté(s)`);
          }}>Exporter la liste de diffusion</Button>
        </div>
        <p className="text-xs text-muted-foreground">La liste de diffusion ne contient que les clients ayant donné leur consentement et disposant d'un email (RGPD).</p>
      </section>

      <CampaignPanel restaurantId={r.id} targets={rows.filter((c) => c.marketing_consent && c.email)} />

      <div className={`overflow-x-auto rounded-xl border border-border ${isFetching ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-2">Client</th><th>Contact</th><th>Origine</th><th className="text-right">Cmd</th><th className="text-right">Dépensé</th><th>Dernière</th><th>Consentement</th><th /></tr></thead>
          <tbody>
            {rows.slice(0, 500).map((c) => { const s = stats(c); return (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-medium">{c.name ?? "—"}</td>
                <td><div>{c.email ?? ""}</div><div className="text-muted-foreground">{c.phone ?? ""}</div></td>
                <td>{SRC[c.source] ?? c.source}</td>
                <td className="text-right">{s.orders}</td><td className="text-right">{eur(s.spent)}</td>
                <td>{s.last ? new Date(s.last).toLocaleDateString("fr-FR") : "—"}</td>
                <td><label className="flex items-center gap-2"><Switch checked={c.marketing_consent} onCheckedChange={(v) => setConsent(c, v)} aria-label="Consentement marketing" />
                  {c.consent_at && <span className="text-xs text-muted-foreground" title={c.consent_source ?? ""}>{new Date(c.consent_at).toLocaleDateString("fr-FR")}</span>}</label></td>
                <td><Button size="icon" variant="ghost" onClick={() => erase(c)} aria-label="Supprimer la fiche"><Trash2 /></Button></td>
              </tr>
            ); })}
            {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucun client.</td></tr>}
          </tbody>
        </table>
        {rows.length > 500 && <p className="p-2 text-center text-xs text-muted-foreground">500 premiers affichés — utilisez l'export pour la liste complète.</p>}
      </div>
    </div>
  );
}

async function insertChunks(restaurantId: string, list: ImportRow[], source: string, consentAttested: boolean) {
  const now = new Date().toISOString();
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await supabase.from("restaurant_customers").insert(list.slice(i, i + 500).map((x) => ({
      restaurant_id: restaurantId, name: x.name, email: x.email, phone: x.phone, source,
      marketing_consent: consentAttested && x.consent, consent_at: consentAttested && x.consent ? now : null, consent_source: consentAttested && x.consent ? `import ${now.slice(0, 10)}` : null,
    })));
    if (error) return { error: error.message };
  }
  return { error: null };
}

function ImportPanel({ restaurantId, existing, onDone }: { restaurantId: string; existing: Customer[]; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attest, setAttest] = useState(false);
  const [plan, setPlan] = useState<{ file: string; add: ImportRow[]; merge: { c: Customer; x: ImportRow }[]; invalid: number; dupInFile: number } | null>(null);

  const analyse = async (f: File) => {
    try {
      const { rows, invalid, dupInFile } = parseImport(await readSheet(f));
      const byE = new Map(existing.filter((c) => c.email).map((c) => [c.email!, c]));
      const byP = new Map(existing.filter((c) => c.phone).map((c) => [c.phone!, c]));
      const add: ImportRow[] = [], merge: { c: Customer; x: ImportRow }[] = [];
      rows.forEach((x) => { const c = (x.email && byE.get(x.email)) || (x.phone && byP.get(x.phone)); if (c) merge.push({ c, x }); else add.push(x); });
      setPlan({ file: f.name, add, merge, invalid, dupInFile }); setAttest(false);
    } catch { toast.error("Fichier illisible. Utilisez un CSV ou un fichier Excel (.xlsx)."); }
  };

  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    const { error } = await insertChunks(restaurantId, plan.add, "import", attest);
    if (error) { setBusy(false); toast.error(error); return; }
    const now = new Date().toISOString();
    const updates = plan.merge.map(({ c, x }) => {
      const patch: { name?: string; email?: string; phone?: string; marketing_consent?: boolean; consent_at?: string; consent_source?: string } = {};
      if (!c.name && x.name) patch.name = x.name;
      if (!c.email && x.email && !existing.some((o) => o.email === x.email)) patch.email = x.email;
      if (!c.phone && x.phone && !existing.some((o) => o.phone === x.phone)) patch.phone = x.phone;
      if (attest && x.consent && !c.marketing_consent) Object.assign(patch, { marketing_consent: true, consent_at: now, consent_source: `import ${now.slice(0, 10)}` });
      return Object.keys(patch).length ? { id: c.id, patch } : null;
    }).filter(Boolean) as { id: string; patch: { name?: string; email?: string; phone?: string } }[];
    for (let i = 0; i < updates.length; i += 6) await Promise.all(updates.slice(i, i + 6).map((u) => supabase.from("restaurant_customers").update(u.patch).eq("id", u.id)));
    setBusy(false); setPlan(null);
    toast.success(`${plan.add.length} ajouté(s), ${updates.length} fiche(s) complétée(s)`);
    onDone();
  };

  const consents = plan ? [...plan.add, ...plan.merge.map((m) => m.x)].filter((x) => x.consent).length : 0;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-2xl">Import du fichier clients (CSV / Excel)</h2>
      {!plan ? (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) analyse(f); }}
          onClick={() => ref.current?.click()}
          className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center ${drag ? "border-primary bg-primary/10" : "border-border"}`}>
          <Upload className="h-8 w-8" />
          <p className="font-semibold">Déposez votre fichier annuel ou cliquez pour le choisir</p>
          <p className="text-sm text-muted-foreground">Colonnes reconnues : nom (ou prénom + nom), email, téléphone, consentement (oui/non). Les doublons sont fusionnés par email ou téléphone.</p>
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyse(f); e.target.value = ""; }} />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm">Fichier <b>{plan.file}</b></p>
          <ul className="grid gap-2 text-sm sm:grid-cols-4">
            <li className="rounded-lg bg-muted p-3"><b className="text-2xl">{plan.add.length}</b><br />nouveaux clients</li>
            <li className="rounded-lg bg-muted p-3"><b className="text-2xl">{plan.merge.length}</b><br />déjà connus (fusionnés)</li>
            <li className="rounded-lg bg-muted p-3"><b className="text-2xl">{plan.dupInFile}</b><br />doublons dans le fichier</li>
            <li className="rounded-lg bg-muted p-3"><b className="text-2xl">{plan.invalid}</b><br />lignes sans email ni téléphone</li>
          </ul>
          {consents > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <Checkbox checked={attest} onCheckedChange={(v) => setAttest(v === true)} className="mt-0.5" />
              <span>J'atteste que les {consents} client(s) marqués « oui » ont donné leur accord explicite pour recevoir des offres du restaurant (RGPD). Sans cette case, ils seront importés sans consentement marketing.</span>
            </label>
          )}
          <div className="flex gap-2">
            <Button onClick={apply} disabled={busy || (!plan.add.length && !plan.merge.length)}>{busy ? "Import…" : "Valider l'import"}</Button>
            <Button variant="ghost" onClick={() => setPlan(null)}>Annuler</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CampaignPanel({ restaurantId, targets }: { restaurantId: string; targets: Customer[] }) {
  const send = useServerFn(sendCampaign);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Commander");
  const [test, setTest] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: history, refetch } = useQuery({
    queryKey: ["campaigns", restaurantId],
    queryFn: async () => (await supabase.from("restaurant_campaigns").select("id, subject, recipients, status, error, created_at").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const go = async (testEmail?: string) => {
    if (!testEmail && !confirm(`Envoyer « ${subject} » à ${targets.length} client(s) consentant(s) ?`)) return;
    setBusy(true);
    try {
      const res = await send({ data: { restaurantId, customerIds: testEmail ? [targets[0]?.id ?? restaurantId] : targets.map((c) => c.id), subject, body, ctaUrl: ctaUrl || "", ctaLabel, origin: window.location.origin, ...(testEmail ? { testEmail } : {}) } });
      if (res.test) toast.success(`Email de test envoyé à ${testEmail}`);
      else { if (res.error) toast.warning(`${res.sent} envoyé(s), puis erreur : ${res.error}`); else toast.success(`Campagne envoyée à ${res.sent} client(s)`); refetch(); }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const ready = subject.trim().length >= 3 && body.trim().length >= 5;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-2xl">Campagne email (Brevo)</h2>
      <p className="text-sm text-muted-foreground">Destinataires : les <b>{targets.length}</b> client(s) consentant(s) avec email correspondant au ciblage ci-dessus. Un lien de désabonnement est ajouté automatiquement.</p>
      <Input placeholder="Objet — ex. -15 % ce week-end sur les plateaux" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
      <Textarea placeholder="Votre message…" rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Lien du bouton (ex. adresse de votre page de commande)" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
        <Input placeholder="Texte du bouton" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" type="email" placeholder="Votre email pour un test" value={test} onChange={(e) => setTest(e.target.value)} />
        <Button variant="secondary" disabled={busy || !ready || !test.includes("@")} onClick={() => go(test)}>Envoyer un test</Button>
        <Button className="ml-auto" disabled={busy || !ready || !targets.length} onClick={() => go()}>{busy ? "Envoi…" : `Envoyer à ${targets.length} client(s)`}</Button>
      </div>
      {!!history?.length && (
        <div className="text-sm"><p className="font-semibold">Historique</p>
          {history.map((h) => <p key={h.id} className="border-t border-border py-1">{new Date(h.created_at).toLocaleString("fr-FR")} · {h.subject} · {h.recipients} destinataire(s) · {h.status === "sent" ? "Envoyée" : h.status === "partial" ? "Partielle" : "Échec"}{h.error ? ` — ${h.error}` : ""}</p>)}
        </div>
      )}
    </section>
  );
}
