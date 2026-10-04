import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getVoiceChannel, saveVoiceChannel } from "@/lib/voice.functions";
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
        </div>
      )}
    </section>
  );
}
