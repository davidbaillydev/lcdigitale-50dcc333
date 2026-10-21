import { useState, type FormEvent } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { listLimitedAccess, grantLimitedAccess, revokeLimitedAccess, deleteLimitedAccount } from "@/lib/agency-admins.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const limitedAccessQuery = { queryKey: ["limited-access"], queryFn: () => listLimitedAccess() };
const ROLE = { manager: "Gérant — commandes, carte, réglages, clients, statistiques", kitchen: "Cuisine — écran cuisine et réservations" } as const;

export function LimitedAccessPanel() {
  const { data } = useSuspenseQuery(limitedAccessQuery);
  const grant = useServerFn(grantLimitedAccess);
  const revoke = useServerFn(revokeLimitedAccess);
  const removeAccount = useServerFn(deleteLimitedAccount);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "kitchen">("manager");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => data.restaurants.find((r) => r.id === id)?.name ?? "Restaurant";
  const refresh = () => qc.invalidateQueries({ queryKey: limitedAccessQuery.queryKey });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !picked.length) return;
    setBusy(true);
    try {
      const r = await grant({ data: { email, role, restaurantIds: picked } });
      toast.success(r.invited ? "Invitation envoyée avec un accès limité." : "Accès limité ajouté au compte.");
      setEmail(""); setPicked([]); await refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Ajout impossible"); } finally { setBusy(false); }
  }
  async function remove(userId: string, restaurantId: string, r: "manager" | "kitchen") {
    if (!confirm("Retirer cet accès ?")) return;
    try { await revoke({ data: { userId, restaurantId, role: r } }); toast.success("Accès retiré"); await refresh(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Retrait impossible"); }
  }
  async function removeAccountClick(userId: string, accountEmail: string) {
    if (!confirm(`Supprimer définitivement le compte ${accountEmail} ?\n\nTous ses accès restaurants seront retirés et le compte sera supprimé. Cette action est irréversible.`)) return;
    try { await removeAccount({ data: { userId } }); toast.success("Compte supprimé"); await refresh(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Suppression impossible"); }
  }

  return <section className="space-y-6 border-t border-border pt-6">
    <div><h2 className="flex items-center gap-2 font-display text-2xl"><KeyRound className="text-primary" /> Accès limités</h2>
      <p className="text-sm text-muted-foreground">Donnez accès à certains restaurants seulement, avec un rôle précis. Ces comptes n'ont pas accès à la console agence.</p></div>
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <div className="space-y-2"><Label htmlFor="la-email">Adresse email</Label><Input id="la-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Rôle</legend>
        {(Object.keys(ROLE) as (keyof typeof ROLE)[]).map((k) => <label key={k} className="flex min-h-11 items-center gap-3"><input type="radio" name="la-role" checked={role === k} onChange={() => setRole(k)} className="h-5 w-5 accent-primary" />{ROLE[k]}</label>)}
      </fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Restaurants autorisés</legend>
        <div className="grid gap-1 sm:grid-cols-2">{data.restaurants.map((r) => <label key={r.id} className="flex min-h-11 items-center gap-3"><Checkbox checked={picked.includes(r.id)} onCheckedChange={(v) => setPicked((p) => v === true ? [...p, r.id] : p.filter((x) => x !== r.id))} />{r.name}</label>)}</div>
      </fieldset>
      <Button type="submit" disabled={busy || !email.trim() || !picked.length}>{busy ? "Ajout…" : "Accorder l'accès limité"}</Button>
    </form>
    <ul className="divide-y divide-border">
      {data.accounts.length === 0 && <li className="py-4 text-sm text-muted-foreground">Aucun accès limité.</li>}
      {data.accounts.map((a) => <li key={a.id} className="space-y-2 py-4"><p className="break-all font-semibold">{a.email}</p>
        <div className="flex flex-wrap gap-2">{a.access.map((x) => <span key={x.restaurantId + x.role} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm text-secondary-foreground">
          {name(x.restaurantId)} · {x.role === "manager" ? "Gérant" : "Cuisine"}
          <button type="button" aria-label="Retirer l'accès" className="grid h-8 w-8 place-items-center" onClick={() => remove(a.id, x.restaurantId, x.role)}><X className="h-4 w-4" /></button></span>)}</div></li>)}
    </ul>
  </section>;
}
