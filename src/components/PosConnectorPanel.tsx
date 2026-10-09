import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPosConfig, savePosConfig, testPosConnection } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type P = "none" | "hubrise" | "hiboutik" | "webhook";
const PROVIDERS: [P, string][] = [["none", "Désactivé"], ["hubrise", "HubRise"], ["hiboutik", "Hiboutik"], ["webhook", "Webhook personnalisé"]];
const FIELDS: Record<P, { k: string; label: string; secret?: boolean; placeholder?: string }[]> = {
  none: [],
  hubrise: [{ k: "accessToken", label: "Access Token", secret: true }, { k: "locationId", label: "Location ID", placeholder: "ex. 3r4s3-0" }, { k: "accountId", label: "Account ID (facultatif)" }, { k: "catalogId", label: "Catalog ID (facultatif)" }],
  hiboutik: [{ k: "account", label: "Nom du compte", placeholder: "moncompte (moncompte.hiboutik.com)" }, { k: "login", label: "Email de connexion API" }, { k: "apiKey", label: "Clé API", secret: true }, { k: "storeId", label: "Store ID", placeholder: "1" }],
  webhook: [{ k: "url", label: "URL du point de terminaison", placeholder: "https://…" }, { k: "secret", label: "Clé secrète (Bearer + signature)", secret: true }],
};

/** Caisse enregistreuse (POS) — réservé à l'agence, visible si le module pos_sync est actif. */
export function PosConnectorPanel({ restaurantId }: { restaurantId: string }) {
  const load = useServerFn(getPosConfig), save = useServerFn(savePosConfig), test = useServerFn(testPosConnection);
  const [provider, setProvider] = useState<P>("none");
  const [silent, setSilent] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [masked, setMasked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const refresh = () => load({ data: { restaurantId } }).then((c) => { setProvider(c.provider as P); setSilent(c.silent_sync); setSettings(c.settings); setMasked(c.masked); setCreds({}); }).catch((e) => toast.error((e as Error).message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [restaurantId]);

  const submit = async () => {
    setBusy(true); setResult(null);
    try { await save({ data: { restaurantId, provider, silent_sync: silent, settings, credentials: creds } }); toast.success("Caisse enregistrée"); await refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const runTest = async () => {
    setBusy(true); setResult(null);
    try { const r = await test({ data: { restaurantId } }); setResult({ ok: true, msg: r.message }); }
    catch (e) { setResult({ ok: false, msg: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-3xl">Caisse enregistreuse (POS)</h2>
      <p className="mb-4 text-sm text-muted-foreground">Chaque commande validée (site, borne, QR) est envoyée automatiquement à la caisse.</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={provider === v} onClick={() => { setProvider(v); setResult(null); }}
            className={"min-h-12 rounded-lg border px-3 text-sm font-medium " + (provider === v ? "border-primary bg-primary/10" : "border-border")}>{l}</button>
        ))}
      </div>
      {provider !== "none" && <>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS[provider].map((f) => (
            <div key={f.k} className="space-y-1">
              <Label htmlFor={`pos-${f.k}`}>{f.label}</Label>
              {f.secret
                ? <Input id={`pos-${f.k}`} type="password" autoComplete="off" value={creds[f.k] ?? ""} placeholder={masked[f.k] || "Non renseigné"} onChange={(e) => setCreds({ ...creds, [f.k]: e.target.value })} />
                : <Input id={`pos-${f.k}`} value={settings[f.k] ?? ""} placeholder={f.placeholder} onChange={(e) => setSettings({ ...settings, [f.k]: e.target.value })} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Les clés enregistrées restent sur le serveur ; laissez vide pour conserver la valeur actuelle.</p>
        <label className="mt-4 flex items-center justify-between gap-4 py-2">
          <span><span className="font-medium">Synchronisation silencieuse</span><span className="block text-sm text-muted-foreground">Demande à la caisse de ne pas réimprimer le ticket (déjà imprimé par la cuisine).</span></span>
          <Switch checked={silent} onCheckedChange={setSilent} />
        </label>
      </>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}>Enregistrer</Button>
        {provider !== "none" && <Button variant="secondary" onClick={runTest} disabled={busy}>Tester la connexion</Button>}
      </div>
      {result && <p role={result.ok ? "status" : "alert"} className={"mt-3 rounded p-2 text-sm " + (result.ok ? "bg-primary/15" : "bg-destructive/20")}>{result.msg}</p>}
    </section>
  );
}
