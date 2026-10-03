import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";
import { inviteMember, listStaff, setStaffRole } from "@/lib/staff.functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/espace/$slug/equipe")({
  head: () => ({
    meta: [
      { title: "Équipe du restaurant" },
      { name: "description", content: "Gestion des accès de l'équipe d'un restaurant." },
      { property: "og:title", content: "Équipe du restaurant" },
      { property: "og:description", content: "Gestion des accès." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Team,
});

function Team() {
  const { slug } = Route.useParams();
  const { loading, restaurants } = useStaff();
  const restaurant = restaurants.find((r) => r.slug === slug);
  const canManage = restaurant?.role === "agency" || restaurant?.role === "manager";
  const list = useServerFn(listStaff);
  const setRole = useServerFn(setStaffRole);
  const qc = useQueryClient();
  const rid = restaurant?.id ?? "";
  const { data } = useQuery({ queryKey: ["staff", rid], queryFn: () => list({ data: { restaurantId: rid } }), enabled: canManage });

  const invite = useServerFn(inviteMember);
  const [email, setEmail] = useState("");
  const [role, setRoleSel] = useState<"kitchen" | "manager">("kitchen");
  const [busy, setBusy] = useState(false);
  if (loading) return null;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;

  const sendInvite = async () => {
    setBusy(true);
    try {
      const r = await invite({ data: { restaurantId: rid, email, role, origin: window.location.origin } });
      toast.success(r.invited ? "Invitation envoyée par email" : "Compte existant rattaché au restaurant");
      setEmail(""); qc.invalidateQueries({ queryKey: ["staff", rid] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  };

  const toggle = async (userId: string, role: "kitchen" | "manager", grant: boolean) => {
    try { await setRole({ data: { restaurantId: rid, userId, role, grant } }); qc.invalidateQueries({ queryKey: ["staff", rid] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between"><Button asChild variant="ghost"><Link to="/espace/$slug" params={{ slug }}><ArrowLeft /> Écran cuisine</Link></Button><ThemeToggle /></div>
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
            <label className="flex items-center gap-2 text-sm">Gérant <Switch checked={u.roles.includes("manager")} onCheckedChange={(v) => toggle(u.id, "manager", v)} /></label>
          </li>
        ))}
      </ul>
    </div>
  );
}
