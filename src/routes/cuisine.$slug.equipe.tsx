import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";
import { listStaff, setStaffRole } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/cuisine/$slug/equipe")({
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

  if (loading) return null;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/cuisine" className="underline">Retour</Link></p>;

  const toggle = async (userId: string, role: "kitchen" | "manager", grant: boolean) => {
    try { await setRole({ data: { restaurantId: rid, userId, role, grant } }); qc.invalidateQueries({ queryKey: ["staff", rid] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button asChild variant="ghost"><Link to="/cuisine/$slug" params={{ slug }}><ArrowLeft /> Écran cuisine</Link></Button>
      <h1 className="mt-4 text-5xl">Équipe · {restaurant?.name}</h1>
      <p className="text-sm text-muted-foreground">Les employés créent leur compte depuis « Espace restaurant », puis vous activez leur accès ici. Les comptes déjà rattachés à un autre restaurant n'apparaissent pas.</p>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">Aucun compte en attente.</li>}
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
