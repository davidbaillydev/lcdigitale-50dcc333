import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { listAgencyAdmins, inviteAgencyAdmin } from "@/lib/agency-admins.functions";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/lib/theme";
import { LimitedAccessPanel, limitedAccessQuery } from "@/components/LimitedAccessPanel";

const adminsQuery = { queryKey: ["agency-admins"], queryFn: () => listAgencyAdmins() };
export const Route = createFileRoute("/_authenticated/admin/administrateurs")({
  head: () => ({ meta: [
    { title: "Administrateurs agence — LC Digitale" },
    { name: "description", content: "Gestion des administrateurs de la console agence LC Digitale." },
    { property: "og:title", content: "Administrateurs agence — LC Digitale" },
    { property: "og:description", content: "Comptes administrateurs du réseau de restaurants LC Digitale." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(adminsQuery), context.queryClient.ensureQueryData(limitedAccessQuery)]),
  component: Administrators,
});

function Administrators() {
  const { data: admins } = useSuspenseQuery(adminsQuery);
  const invite = useServerFn(inviteAgencyAdmin);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !confirmed) return;
    setBusy(true); setResult("");
    try {
      const response = await invite({ data: { email } });
      const message = response.alreadyAdmin ? "Ce compte est déjà administrateur." : response.invited ? "Invitation envoyée par email. Le destinataire pourra choisir son mot de passe." : "Accès administrateur ajouté au compte existant. Il peut se connecter avec son mot de passe habituel.";
      setResult(message); toast.success(message); setEmail(""); setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: adminsQuery.queryKey });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ajout impossible";
      setResult(message); toast.error(message);
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><Crumbs page="Administrateurs" /><ThemeToggle /></div>
    <header className="space-y-2"><p className="text-sm font-semibold text-primary">Console agence</p><h1 className="break-words font-display text-4xl sm:text-5xl">Administrateurs</h1><p className="text-muted-foreground">{admins.length} compte{admins.length > 1 ? "s" : ""} · Accès complet à tous les restaurants</p></header>
    <section className="border-y border-border py-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><UserPlus className="text-primary" /> Ajouter un administrateur</h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        <div className="space-y-2"><Label htmlFor="admin-email">Adresse email</Label><Input id="admin-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="prenom@agence.fr" disabled={busy} /></div>
        <div className="flex items-start gap-3"><Checkbox id="full-access" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} disabled={busy} /><Label htmlFor="full-access" className="leading-6">J'accorde l'accès complet à la console agence et à tous les restaurants, y compris les paiements et les données clients.</Label></div>
        <Button type="submit" disabled={busy || !email.trim() || !confirmed}><UserPlus />{busy ? "Ajout en cours…" : "Ajouter l'administrateur"}</Button>
        {result && <p role="status" className="text-sm text-foreground">{result}</p>}
      </form>
    </section>
    <section><h2 className="mb-4 font-display text-2xl">Équipe agence</h2><ul className="divide-y divide-border">
      {admins.map((admin) => <li key={admin.id} className="flex flex-wrap items-center gap-3 py-4"><ShieldCheck className="h-6 w-6 shrink-0 text-primary" aria-hidden /><div className="min-w-0 flex-1"><p className="break-all font-semibold">{admin.email}{admin.isSelf && <span className="ml-2 font-normal text-muted-foreground">(vous)</span>}</p><p className="text-sm text-muted-foreground">Administrateur agence · {admin.activated ? "Compte actif" : "Activation en attente"}</p></div><span className="text-sm text-muted-foreground">Depuis le {new Date(admin.createdAt).toLocaleDateString("fr-FR")}</span></li>)}
    </ul></section>
    <LimitedAccessPanel />
  </main>;
}