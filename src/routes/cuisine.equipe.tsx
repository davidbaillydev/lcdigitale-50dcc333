import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";
import { listStaff, setStaffRole } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/cuisine/equipe")({
  head: () => ({
    meta: [
      { title: "Équipe — Wok & Sushi" },
      { name: "description", content: "Gestion des accès de l'équipe." },
      { property: "og:title", content: "Équipe — Wok & Sushi" },
      { property: "og:description", content: "Gestion des accès." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Team,
});

function Team() {
  const { loading, isAdmin } = useStaff();
  const list = useServerFn(listStaff);
  const setRole = useServerFn(setStaffRole);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["staff"], queryFn: () => list(), enabled: isAdmin });

  if (loading) return null;
  if (!isAdmin) return <p className="p-10 text-center">Réservé au gérant. <Link to="/cuisine" className="underline">Retour</Link></p>;

  const toggle = async (userId: string, role: "staff" | "admin", grant: boolean) => {
    try { await setRole({ data: { userId, role, grant } }); qc.invalidateQueries({ queryKey: ["staff"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button asChild variant="ghost"><Link to="/cuisine"><ArrowLeft /> Écran cuisine</Link></Button>
      <h1 className="mt-4 text-5xl">Équipe</h1>
      <p className="text-sm text-muted-foreground">Les employés créent leur compte depuis « Espace restaurant », puis vous activez leur accès ici.</p>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {data?.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-4 p-4">
            <span className="mr-auto min-w-0 truncate">{u.email}</span>
            <label className="flex items-center gap-2 text-sm">Cuisine <Switch checked={u.roles.includes("staff")} onCheckedChange={(v) => toggle(u.id, "staff", v)} /></label>
            <label className="flex items-center gap-2 text-sm">Gérant <Switch checked={u.roles.includes("admin")} onCheckedChange={(v) => toggle(u.id, "admin", v)} /></label>
          </li>
        ))}
      </ul>
    </div>
  );
}
