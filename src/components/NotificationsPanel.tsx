import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveNotifications } from "@/lib/restaurant-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { directRecipientSchema, orderModeLabels, type OrderMode, type DirectRecipient } from "@/lib/order-notification-roles";

type N = { received?: boolean; confirmed?: boolean; restaurant?: boolean; email?: string; team?: boolean; agency?: boolean; recipients?: DirectRecipient[] };

export function NotificationsPanel({ restaurantId, notifications, defaultEmail, onSaved }: { restaurantId: string; notifications?: N | undefined; defaultEmail: string | null; onSaved?: () => void }) {
  const save = useServerFn(saveNotifications);
  const [n, setN] = useState({
    received: notifications?.received !== false, confirmed: notifications?.confirmed !== false, restaurant: notifications?.restaurant !== false,
    email: notifications?.email || defaultEmail || "",
    team: notifications?.team !== false, agency: notifications?.agency !== false,
  });
  const [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState<DirectRecipient[]>(notifications?.recipients ?? ((notifications?.email || defaultEmail) ? [{ email: notifications?.email || defaultEmail || "", enabled: true, modes: ["delivery", "pickup", "dine_in"] }] : []));
  const [newEmail, setNewEmail] = useState("");
  const addRecipient = () => {
    const parsed = directRecipientSchema.safeParse({ email: newEmail, enabled: true, modes: ["delivery", "pickup", "dine_in"] });
    if (!parsed.success) { toast.error("Saisissez une adresse e-mail valide"); return; }
    if (recipients.some((r) => r.email.toLowerCase() === parsed.data.email)) { toast.error("Cette adresse est déjà présente"); return; }
    setRecipients([...recipients, parsed.data]); setNewEmail("");
  };
  const row = (k: "received" | "confirmed" | "restaurant" | "team" | "agency", label: string) => (
    <label className="flex min-h-11 items-center justify-between gap-3"><span>{label}</span><Switch checked={n[k]} onCheckedChange={(v) => setN({ ...n, [k]: v })} aria-label={label} /></label>
  );
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId, notifications: { ...n, recipients } } }); toast.success("Notifications enregistrées"); onSaved?.(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-3xl">Notifications</h2>
      {row("received", "Email « Commande reçue » au client")}
      {row("confirmed", "Email « Commande confirmée » au client")}
      {row("restaurant", "Email « Nouvelle commande » au restaurant")}
      {row("team", "Destinataires de l’équipe selon leur fonction")}
      {row("agency", "Copie aux administrateurs agence")}
      <div className="space-y-3">
        <Label htmlFor="notif-email">Destinataires des nouvelles commandes</Label>
        <div className="flex gap-2"><Input id="notif-email" type="email" maxLength={255} value={newEmail} placeholder="email@exemple.fr" onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }} /><Button variant="secondary" onClick={addRecipient} disabled={busy} aria-label="Ajouter un destinataire"><Plus />Ajouter</Button></div>
        {recipients.length === 0 && <p className="text-sm text-muted-foreground">Aucun destinataire direct.</p>}
        {recipients.map((recipient, i) => (
          <div key={recipient.email} className="space-y-2 border-b border-border pb-3">
            <div className="flex min-w-0 items-center gap-3"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2"><Checkbox aria-label={`Activer ${recipient.email}`} checked={recipient.enabled} disabled={busy} onCheckedChange={(v) => setRecipients(recipients.map((r, idx) => idx === i ? { ...r, enabled: v === true } : r))} /><span className="min-w-0 break-all text-sm">{recipient.email}</span></label><Button size="icon" variant="ghost" disabled={busy} aria-label={`Supprimer ${recipient.email}`} onClick={() => setRecipients(recipients.filter((_, idx) => idx !== i))}><Trash2 /></Button></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">{(Object.entries(orderModeLabels) as [OrderMode, string][]).map(([mode, label]) => <label key={mode} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox aria-label={`${label} — ${recipient.email}`} checked={recipient.modes.includes(mode)} disabled={busy || !recipient.enabled} onCheckedChange={(v) => setRecipients(recipients.map((r, idx) => idx === i ? { ...r, modes: v === true ? [...new Set([...r.modes, mode])] : r.modes.filter((m) => m !== mode) } : r))} />{label}</label>)}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-border pt-4"><Button className="w-full sm:w-auto" onClick={submit} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les notifications"}</Button></div>
    </section>
  );
}
