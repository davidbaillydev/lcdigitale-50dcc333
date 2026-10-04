import { Crumbs } from "@/components/Crumbs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Link2 } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";
import { getActivationLink, inviteMember, listStaff, setStaffRole } from "@/lib/staff.functions";
import { hasKitchenPin, setKitchenPin } from "@/lib/kitchen-pin.functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/espace/$slug/equipe")({
  head: () => ({
    meta: [
      { title: "Équipe du restaurant — LC Digitale" },
      { name: "description", content: "Gestion des accès de l'équipe d'un restaurant." },
      { property: "og:title", content: "Équipe du restaurant — LC Digitale" },
      { property: "og:description", content: "Gestion des accès." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Team,
});

function Team() {
  const { slug } = Route.useParams();
  const { loading, restaurants } = useStaff();
  const restaurant = restaurants.find((r) => r.slug === slug);
  const canManage = restaurant?.role === "agency";
  const list = useServerFn(listStaff);
  const setRole = useServerFn(setStaffRole);
  const qc = useQueryClient();
  const rid = restaurant?.id ?? "";
  const { data } = useQuery({ queryKey: ["staff", rid], queryFn: () => list({ data: { restaurantId: rid } }), enabled: canManage });

  const invite = useServerFn(inviteMember);
  const [email, setEmail] = useState("");
  const [role, setRoleSel] = useState<"kitchen" | "manager">("kitchen");
  const [busy, setBusy] = useState(false);
  const linkFn = useServerFn(getActivationLink);
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);
  const pinCheck = useServerFn(hasKitchenPin);
  const pinSave = useServerFn(setKitchenPin);
  const { data: pinState, refetch: refetchPin } = useQuery({ queryKey: ["pin", rid], queryFn: () => pinCheck({ data: { restaurantId: rid } }), enabled: canManage });
  const [pin, setPin] = useState("");
  if (loading) return null;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;

  const sendInvite = async () => {
    setBusy(true);
    try {
      const r = await invite({ data: { restaurantId: rid, email, role, origin: window.location.origin } });
      toast.success(r.invited ? "Invitation envoyée par email avec le lien d'activation" : "Compte existant rattaché au restaurant");
      setEmail(""); qc.invalidateQueries({ queryKey: ["staff", rid] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  };

  const toggle = async (userId: string, role: "kitchen" | "manager", grant: boolean) => {
    try { await setRole({ data: { restaurantId: rid, userId, role, grant } }); qc.invalidateQueries({ queryKey: ["staff", rid] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  const copyLink = async (userId: string) => {
    if (!confirm("Créer un nouveau lien d'activation ? Le lien envoyé précédemment par email ne fonctionnera plus.")) return;
    try { const r = await linkFn({ data: { restaurantId: rid, userId, origin: window.location.origin } }); setLink(r); await navigator.clipboard?.writeText(r.link).catch(() => {}); toast.success("Lien copié"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };
  const savePin = async (p: string | null) => {
    try { await pinSave({ data: { restaurantId: rid, pin: p } }); setPin(""); refetchPin(); toast.success(p ? "Code PIN cuisine enregistré" : "Code PIN supprimé"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between"><Crumbs slug={slug} page="Équipe" /><ThemeToggle /></div>
      <h1 className="mt-4 text-5xl">Équipe · {restaurant?.name}</h1>
      <p className="text-sm text-muted-foreground">Invitez vos gérants et votre équipe cuisine par email : ils reçoivent un lien pour choisir leur mot de passe. Ils n'accèdent qu'à ce restaurant.</p>
      <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
        <Input type="email" placeholder="email@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-56 flex-1" aria-label="Email à inviter" />
        <select value={role} onChange={(e) => setRoleSel(e.target.value as "kitchen" | "manager")} className="h-9 rounded-md border border-input bg-background px-2" aria-label="Rôle">
          <option value="kitchen">Cuisine</option><option value="manager">Gérant</option>
        </select>
        <Button onClick={sendInvite} disabled={busy || !email.includes("@")}>{busy ? "Envoi…" : "Inviter"}</Button>
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">Aucun membre pour le moment.</li>}
        {data?.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-4 p-4">
            <span className="mr-auto min-w-0 truncate">{u.email}</span>
            <label className="flex items-center gap-2 text-sm">Cuisine <Switch checked={u.roles.includes("kitchen")} onCheckedChange={(v) => toggle(u.id, "kitchen", v)} /></label>
            <Button size="sm" variant="ghost" onClick={() => copyLink(u.id)} title="Lien d'activation à partager (SMS, WhatsApp…)"><Link2 /> Lien</Button>
            <label className="flex items-center gap-2 text-sm">Gérant <Switch checked={u.roles.includes("manager")} onCheckedChange={(v) => toggle(u.id, "manager", v)} /></label>
          </li>
        ))}
      </ul>
      {link && <div className="mt-4 rounded-xl border border-primary bg-primary/5 p-4">
        <p className="text-sm">Lien d'activation pour <strong>{link.email}</strong> — à transmettre directement au restaurateur :</p>
        <div className="mt-2 flex gap-2"><Input readOnly value={link.link} onFocus={(e) => e.target.select()} aria-label="Lien d'activation" /><Button size="icon" onClick={() => { navigator.clipboard?.writeText(link.link); toast.success("Lien copié"); }} aria-label="Copier"><Copy /></Button></div>
      </div>}
      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-3xl"><KeyRound className="h-6 w-6 text-primary" /> Code PIN cuisine</h2>
        <p className="text-sm text-muted-foreground">Verrouille la tablette de cuisine ou de salle (bouton « Verrouiller », ou automatiquement après 5 minutes sans activité). L'équipe la déverrouille avec ce code, sans se reconnecter. {pinState?.enabled ? "Un code est actif." : "Aucun code pour le moment."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input inputMode="numeric" type="password" maxLength={6} placeholder="4 à 6 chiffres" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="w-40" aria-label="Nouveau code PIN" />
          <Button onClick={() => savePin(pin)} disabled={pin.length < 4}>{pinState?.enabled ? "Changer le code" : "Activer le code"}</Button>
          {pinState?.enabled && <Button variant="ghost" onClick={() => savePin(null)}>Supprimer le code</Button>}
        </div>
      </section>
    </div>
  );
}
