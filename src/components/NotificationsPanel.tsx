import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveNotifications } from "@/lib/restaurant-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type N = { received?: boolean; confirmed?: boolean; restaurant?: boolean; email?: string };

export function NotificationsPanel({ restaurantId, notifications, defaultEmail, onSaved }: { restaurantId: string; notifications?: N | undefined; defaultEmail: string | null; onSaved?: () => void }) {
  const save = useServerFn(saveNotifications);
  const [n, setN] = useState({
    received: notifications?.received !== false, confirmed: notifications?.confirmed !== false, restaurant: notifications?.restaurant !== false,
    email: notifications?.email || defaultEmail || "",
  });
  const [busy, setBusy] = useState(false);
  const row = (k: "received" | "confirmed" | "restaurant", label: string) => (
    <label className="flex min-h-11 items-center justify-between gap-3"><span>{label}</span><Switch checked={n[k]} onCheckedChange={(v) => setN({ ...n, [k]: v })} aria-label={label} /></label>
  );
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId, notifications: n } }); toast.success("Notifications enregistrées"); onSaved?.(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-3xl">Notifications</h2>
      {row("received", "Email « Commande reçue » au client")}
      {row("confirmed", "Email « Commande confirmée » au client")}
      {row("restaurant", "Email « Nouvelle commande » au restaurant")}
      <div><Label htmlFor="notif-email">Email de réception des commandes</Label><Input id="notif-email" type="email" maxLength={255} value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></div>
      <div className="flex justify-end border-t border-border pt-4"><Button className="w-full sm:w-auto" onClick={submit} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les notifications"}</Button></div>
    </section>
  );
}
