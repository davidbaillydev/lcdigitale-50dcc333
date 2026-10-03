import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPaymentProviders, pairSumupReader, savePaymentProvider, testLyra, testPaypal, testStripe, testSumup, type Provider } from "@/lib/payments.functions";

const MODES: Partial<Record<Provider, { options: [string, string][]; hint?: string }>> = {
  stripe: { options: [["test", "Test (aucun vrai paiement)"], ["live", "Réel (live)"]], hint: "Apple Pay et Google Pay s'affichent automatiquement s'ils sont activés dans votre compte Stripe." },
  paypal: { options: [["sandbox", "Sandbox (test)"], ["live", "Live (réel)"]], hint: "Identifiants à créer dans PayPal Developer → Apps & Credentials." },
  lyra: { options: [["TEST", "Test"], ["PRODUCTION", "Production"]], hint: "Utilisez la clé correspondant au mode (back-office Lyra → Paramétrage → Boutique → Clés)." },
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const META: Record<Provider, { name: string; desc: string; fields: { key: string; label: string; secret: boolean; placeholder: string }[]; available: boolean }> = {
  sumup: {
    name: "SumUp", desc: "Paiement par carte sur le terminal SumUp Solo relié à la borne.", available: true,
    fields: [
      { key: "apiKey", label: "Clé API secrète", secret: true, placeholder: "sup_sk_..." },
      { key: "merchantCode", label: "Code marchand", secret: false, placeholder: "MXXXXXXX" },
    ],
  },
  stripe: {
    name: "Stripe", desc: "Paiement en ligne sur le site : carte bancaire, Apple Pay, Google Pay.", available: true,
    fields: [
      { key: "publishableKey", label: "Clé publiable", secret: false, placeholder: "pk_test_..." },
      { key: "secretKey", label: "Clé secrète", secret: true, placeholder: "sk_test_..." },
    ],
  },
  paypal: {
    name: "PayPal", desc: "Paiement en ligne sur le site avec un compte PayPal (ou une carte via PayPal).", available: true,
    fields: [
      { key: "clientId", label: "Client ID", secret: true, placeholder: "AXxx..." },
      { key: "secret", label: "Secret", secret: true, placeholder: "EXxx..." },
    ],
  },
  lyra: {
    name: "Lyra / PayZen", desc: "Paiement par carte sur la page sécurisée de votre banque (PayZen, Systempay, Sogecommerce…).", available: true,
    fields: [
      { key: "siteId", label: "Identifiant boutique (Site ID)", secret: false, placeholder: "12345678" },
      { key: "key", label: "Clé (certificat HMAC-SHA-256)", secret: true, placeholder: "Clé de test ou de production" },
      { key: "gateway", label: "Adresse de la plateforme", secret: false, placeholder: "https://secure.payzen.eu/vads-payment/" },
    ],
  },
};

export function PaymentProvidersPanel({ restaurantId }: { restaurantId: string }) {
  const list = useServerFn(listPaymentProviders);
  const { data, refetch } = useQuery({ queryKey: ["pay-providers", restaurantId], queryFn: () => list({ data: { restaurantId } }) });
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-3xl">Prestataires de paiement</h2>
      <p className="mb-4 text-sm text-muted-foreground">Les clés sont gardées sur le serveur et ne sont jamais réaffichées en entier.</p>
      <div className="space-y-4">
        {(data ?? []).map((p) => <ProviderCard key={p.provider} restaurantId={restaurantId} p={p} onChange={() => refetch()} />)}
      </div>
    </section>
  );
}

type P = { provider: Provider; enabled: boolean; credentials: Record<string, string>; settings: Record<string, string> };

function ProviderCard({ restaurantId, p, onChange }: { restaurantId: string; p: P; onChange: () => void }) {
  const m = META[p.provider];
  const save = useServerFn(savePaymentProvider);
  const test = useServerFn(testSumup);
  const testS = useServerFn(testStripe);
  const testP = useServerFn(testPaypal);
  const testL = useServerFn(testLyra);
  const pair = useServerFn(pairSumupReader);
  const [enabled, setEnabled] = useState(p.enabled);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [readers, setReaders] = useState<{ id: string; name: string; status: string }[]>([]);
  const [code, setCode] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setResult(null);
    try { await fn(); } catch (e) { setResult({ ok: false, msg: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xl font-semibold">{m.name} {!m.available && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">Bientôt</span>}</p>
          <p className="text-sm text-muted-foreground">{m.desc}</p>
        </div>
        <Switch aria-label={`Activer ${m.name}`} disabled={!m.available} checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {m.available && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {m.fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`${p.provider}-${f.key}`}>{f.label}</Label>
                <Input id={`${p.provider}-${f.key}`} type={f.secret ? "password" : "text"} autoComplete="off"
                  placeholder={p.credentials[f.key] || f.placeholder} value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
                {p.credentials[f.key] && <p className="mt-1 text-xs text-muted-foreground">Enregistrée : {p.credentials[f.key]} (laisser vide pour conserver)</p>}
              </div>
            ))}
          </div>
          {MODES[p.provider] && (() => {
            const md = MODES[p.provider]!;
            return (
              <div className="max-w-xs">
                <Label htmlFor={`${p.provider}-mode`}>Mode</Label>
                <select id={`${p.provider}-mode`} value={creds["mode"] ?? p.credentials["mode"] ?? md.options[0][0]} onChange={(e) => setCreds({ ...creds, mode: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {md.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {md.hint && <p className="mt-1 text-xs text-muted-foreground">{md.hint}</p>}
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(async () => {
              await save({ data: { restaurantId, provider: p.provider, enabled, credentials: creds } });
              setCreds({}); toast.success(`${m.name} enregistré`); onChange();
            })}>Enregistrer</Button>
            {p.provider === "stripe" && (
              <Button variant="secondary" disabled={busy} onClick={() => run(async () => {
                const r = await testS({ data: { restaurantId } });
                setResult({ ok: r.chargesEnabled, msg: r.chargesEnabled
                  ? `Connexion réussie · compte « ${r.name} » · mode ${r.live ? "réel" : "test"}`
                  : `Clés valides (compte « ${r.name} »), mais ce compte ne peut pas encore encaisser : terminez son activation chez Stripe.` });
              })}>Tester la connexion</Button>
            )}
            {p.provider === "paypal" && (
              <Button variant="secondary" disabled={busy} onClick={() => run(async () => {
                const r = await testP({ data: { restaurantId } });
                setResult({ ok: true, msg: `Connexion réussie · identifiants PayPal acceptés · mode ${r.live ? "Live" : "Sandbox"}` });
              })}>Tester la connexion</Button>
            )}
            {p.provider === "lyra" && (
              <Button variant="secondary" disabled={busy} onClick={() => run(async () => {
                const r = await testL({ data: { restaurantId } });
                setResult({ ok: true, msg: `Plateforme joignable (${r.gateway}) · mode ${r.mode === "PRODUCTION" ? "Production" : "Test"}. La clé sera validée par la banque au premier paiement : faites une commande test.` });
              })}>Tester la connexion</Button>
            )}
            {p.provider === "sumup" && (
              <Button variant="secondary" disabled={busy} onClick={() => run(async () => {
                const r = await test({ data: { restaurantId } });
                setReaders(r.readers);
                setResult({ ok: true, msg: `Connexion réussie · ${r.readers.length} terminal(aux) sur le compte` });
              })}>Tester la connexion</Button>
            )}
          </div>
          {p.provider === "sumup" && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm font-semibold">Terminal de la borne</p>
              <p className="text-sm">{p.settings["readerId"] ? `Associé : ${p.settings["readerName"] ?? p.settings["readerId"]}` : "Aucun terminal associé"}</p>
              {readers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {readers.map((r) => (
                    <Button key={r.id} size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
                      await pair({ data: { restaurantId, readerId: r.id, name: r.name } }); toast.success("Terminal associé"); onChange();
                    })}>Utiliser « {r.name} » ({r.status})</Button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Input placeholder="Code affiché sur le terminal" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-56" />
                <Button size="sm" variant="secondary" disabled={busy || !code} onClick={() => run(async () => {
                  await pair({ data: { restaurantId, pairingCode: code, name: "Borne" } }); setCode(""); toast.success("Terminal associé"); onChange();
                })}>Associer un nouveau terminal</Button>
              </div>
            </div>
          )}
          {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "rounded bg-primary/15 p-2 text-sm" : "rounded bg-destructive/20 p-2 text-sm"}>{result.msg}</p>}
        </div>
      )}
    </div>
  );
}
