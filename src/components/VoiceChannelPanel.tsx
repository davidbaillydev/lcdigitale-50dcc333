import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getVoiceChannel, saveVoiceChannel, listVoiceCalls, type VoiceCall } from "@/lib/voice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type State = { enabled: boolean; secret: string; phone_number: string | null; calls_count: number; last_call_at: string | null } | null;

const TOOLS = `get_menu — aucun paramètre. Renvoie la carte (itemId, prix, options, allergènes).
create_order — { customer_name, phone, mode: "pickup"|"delivery", slot?, address?, postal_code?, notes?,
  lines: [{ itemId, qty, sel?: { groupId: [choiceId] }, notes? }] }`;

/** Canal « Téléphone IA » (Vapi) — réservé à l'agence. */
export function VoiceChannelPanel({ restaurantId }: { restaurantId: string }) {
  const get = useServerFn(getVoiceChannel);
  const save = useServerFn(saveVoiceChannel);
  const [s, setS] = useState<State | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/public/vapi/${restaurantId}` : "";

  const load = () => get({ data: { restaurantId } }).then((r) => { setS(r); setPhone(r?.phone_number ?? ""); }).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (enabled: boolean, regenerate = false) => {
    setBusy(true);
    try { await save({ data: { restaurantId, enabled, phone_number: phone || null, regenerate } }); toast.success(regenerate ? "Nouvelle clé générée : mettez-la à jour dans Vapi" : "Canal enregistré"); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copié"));

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <Phone className="text-primary" />
        <h2 className="mr-auto text-3xl">Téléphone IA (Vapi)</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!s?.enabled} disabled={busy || s === undefined} onCheckedChange={(v) => submit(v)} />
          {s?.enabled ? "Actif" : "Inactif"}
        </label>
      </div>
      <p className="text-sm text-muted-foreground">Un assistant vocal Vapi prend les commandes par téléphone. Elles arrivent en cuisine marquées « TÉLÉPHONE IA », paiement au retrait ou à la livraison.</p>
      {s === undefined ? <p className="text-sm text-muted-foreground">Chargement…</p> : !s ? (
        <Button onClick={() => submit(false)} disabled={busy}>Créer le canal (génère la clé secrète)</Button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1"><Label>Adresse du serveur (Server URL dans Vapi)</Label>
            <div className="flex gap-2"><Input readOnly value={url} /><Button size="icon" variant="secondary" onClick={() => copy(url)} aria-label="Copier l'adresse"><Copy /></Button></div></div>
          <div className="space-y-1"><Label>Clé secrète (champ « Secret » du serveur Vapi, en-tête x-vapi-secret)</Label>
            <div className="flex gap-2">
              <Input readOnly value={show ? s.secret : `••••${s.secret.slice(-4)}`} />
              <Button variant="secondary" onClick={() => setShow(!show)}>{show ? "Masquer" : "Afficher"}</Button>
              <Button size="icon" variant="secondary" onClick={() => copy(s.secret)} aria-label="Copier la clé"><Copy /></Button>
              <Button size="icon" variant="ghost" disabled={busy} onClick={() => confirm("Générer une nouvelle clé ? L'ancienne cessera de fonctionner.") && submit(s.enabled, true)} aria-label="Régénérer la clé"><RefreshCw /></Button>
            </div></div>
          <div className="space-y-1"><Label htmlFor="voice-phone">Numéro de téléphone de l'assistant</Label>
            <div className="flex gap-2"><Input id="voice-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 5 …" /><Button disabled={busy} onClick={() => submit(s.enabled)}>Enregistrer</Button></div></div>
          <p className="text-sm text-muted-foreground">Appels terminés : {s.calls_count}{s.last_call_at ? ` · dernier le ${new Date(s.last_call_at).toLocaleString("fr-FR")}` : ""}</p>
          <details className="text-sm"><summary className="cursor-pointer">Outils à déclarer dans l'assistant Vapi</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{TOOLS}</pre></details>
          <WebhookTester url={url} secret={s.secret} />
          <CallLog restaurantId={restaurantId} />
        </div>
      )}
    </section>
  );
}

const SCENARIOS = {
  menu: { label: "Lire la carte (get_menu)", body: { message: { type: "tool-calls", toolCallList: [{ id: "test-1", function: { name: "get_menu", arguments: {} } }] } } },
  order: { label: "Commande simulée (create_order)", body: { message: { type: "tool-calls", call: { id: "test-call" }, toolCallList: [{ id: "test-2", function: { name: "create_order", arguments: { customer_name: "Test Agence", phone: "0600000000", mode: "pickup", lines: [{ itemId: "REMPLACER_PAR_UN_ID", qty: 1 }] } } }] } } },
  end: { label: "Fin d'appel (end-of-call-report)", body: { message: { type: "end-of-call-report", durationSeconds: 42, endedReason: "customer-ended-call", call: { id: "test-call" } } } },
} as const;

function WebhookTester({ url, secret }: { url: string; secret: string }) {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("menu");
  const [payload, setPayload] = useState(JSON.stringify(SCENARIOS.menu.body, null, 2));
  const [badSecret, setBadSecret] = useState(false);
  const [res, setRes] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = (k: keyof typeof SCENARIOS) => { setScenario(k); setPayload(JSON.stringify(SCENARIOS[k].body, null, 2)); };
  const run = async () => {
    let body: string;
    try { body = JSON.stringify(JSON.parse(payload)); } catch { toast.error("JSON invalide"); return; }
    setBusy(true); const t = performance.now();
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-vapi-secret": badSecret ? "mauvaise-cle" : secret, "x-lc-test": "1" }, body });
      const txt = await r.text();
      let pretty = txt; try { pretty = JSON.stringify(JSON.parse(txt), (k, v) => (k === "result" && typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return v; } })() : v), 2); } catch { /* texte brut */ }
      setRes({ status: r.status, ms: Math.round(performance.now() - t), body: pretty });
    } catch (e) { setRes({ status: 0, ms: 0, body: (e as Error).message }); } finally { setBusy(false); }
  };
  const sig = res && (res.status === 401 ? { ok: false, t: "Signature refusée (clé x-vapi-secret invalide)" } : res.status > 0 ? { ok: true, t: "Signature validée" } : { ok: false, t: "Serveur injoignable" });
  return (
    <details className="rounded-lg border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Tester le webhook (mode test, aucune commande créée)</summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]).map((k) => (
            <Button key={k} size="sm" variant={scenario === k ? "default" : "secondary"} onClick={() => pick(k)}>{SCENARIOS[k].label}</Button>
          ))}
        </div>
        <textarea className="h-40 w-full rounded-md border border-input bg-background p-2 font-mono text-xs" value={payload} onChange={(e) => setPayload(e.target.value)} aria-label="Requête envoyée" />
        <label className="flex items-center gap-2"><Switch checked={badSecret} onCheckedChange={setBadSecret} /> Envoyer une mauvaise clé (vérifier le refus)</label>
        <Button onClick={run} disabled={busy}>{busy ? "Envoi…" : "Envoyer la requête de test"}</Button>
        {res && sig && (
          <div className="space-y-2">
            <p className={sig.ok ? "font-medium text-primary" : "font-medium text-destructive"}>{sig.t} · HTTP {res.status} · {res.ms} ms</p>
            <Label>Réponse renvoyée à Vapi</Label>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{res.body}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

const fmtDur = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`);

function CallLog({ restaurantId }: { restaurantId: string }) {
  const list = useServerFn(listVoiceCalls);
  const [rows, setRows] = useState<VoiceCall[] | null>(null);
  const load = () => list({ data: { restaurantId } }).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-2">
      <div className="flex items-center"><h3 className="mr-auto text-xl">Journal des appels</h3><Button size="sm" variant="ghost" onClick={load}><RefreshCw /> Actualiser</Button></div>
      {!rows ? <p className="text-sm text-muted-foreground">Chargement…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucun appel enregistré.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Date</th><th className="pr-3">Appelant</th><th className="pr-3">Statut</th><th className="pr-3">Durée</th><th>Commande</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-1 pr-3">{new Date(c.created_at).toLocaleString("fr-FR")}</td>
                <td className="pr-3">{c.caller ?? "—"}</td>
                <td className="pr-3">{c.status}{c.ended_reason ? <span className="text-muted-foreground"> · {c.ended_reason}</span> : null}</td>
                <td className="pr-3">{fmtDur(c.duration_seconds)}</td>
                <td>{c.order_number ? `n° ${c.order_number}` : "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
