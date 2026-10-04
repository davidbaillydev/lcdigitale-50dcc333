import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import { saveVapiWebSettings } from "@/lib/vapi-web.functions";
import type { Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function VapiWebPanel({ restaurant: r, onSaved }: { restaurant: Restaurant; onSaved?: () => void }) {
  const save = useServerFn(saveVapiWebSettings);
  const [enabled, setEnabled] = useState(!!r.is_vapi_web_enabled);
  const [assistantId, setAssistantId] = useState(r.vapi_assistant_id ?? "");
  const [publicKey, setPublicKey] = useState(r.vapi_public_key ?? "");
  const [phone, setPhone] = useState(r.vapi_phone_number ?? "");
  const [busy, setBusy] = useState(false);
  const live = !!(r.is_vapi_web_enabled && r.vapi_assistant_id && r.vapi_public_key);

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { restaurantId: r.id, enabled, assistantId, publicKey, phone } });
      toast.success("Assistant vocal enregistré"); onSaved?.();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-3xl"><Mic className="h-6 w-6 text-primary" /> Assistant vocal Kaito (Vapi)</h2>
        <span className={live ? "rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground" : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"}>{live ? "Actif" : "Inactif"}</span>
      </div>
      <label className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <span>Activer la commande vocale sur le site web (widget Vapi)</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Vapi Assistant ID</Label><Input value={assistantId} onChange={(e) => setAssistantId(e.target.value)} placeholder="c1329e94-…" /></div>
        <div className="space-y-1"><Label>Clé publique Vapi</Label><Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="Public key (pas la clé privée)" /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Numéro de téléphone de commande</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 89 00 00 00" /></div>
      </div>
      <p className="text-xs text-muted-foreground">La clé publique se trouve dans Vapi › Organization › API Keys (« Public Key »). Ne collez jamais la clé privée ici : elle serait visible sur le site. Le numéro s'affiche en haut du site avec un bouton d'appel.</p>
      <Button onClick={submit} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
    </section>
  );
}
