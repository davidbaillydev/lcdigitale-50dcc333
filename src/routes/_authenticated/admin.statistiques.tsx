import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crumbs } from "@/components/Crumbs";
import { ConversionFunnel } from "@/components/ConversionFunnel";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/admin/statistiques")({
  head: () => ({
    meta: [
      { title: "Tunnel de conversion — Console agence" },
      { name: "description", content: "Conversion et paniers abandonnés de tous les restaurants." },
      { property: "og:title", content: "Tunnel de conversion — Console agence" },
      { property: "og:description", content: "Vue agence des paniers abandonnés." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const [rid, setRid] = useState("");
  const { data } = useQuery({
    queryKey: ["agency-restaurants-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("id, name").order("sort_order").order("name");
      if (error) throw error;
      return data;
    },
  });
  const all = data ?? [];
  const names = Object.fromEntries(all.map((r) => [r.id, r.name]));
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-2"><Crumbs page="Statistiques" /><span className="mr-auto" /><ThemeToggle /></div>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-5xl">Tunnel de conversion & abandon</h1>
        <select aria-label="Restaurant" value={rid} onChange={(e) => setRid(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
          <option value="">Tous les restaurants</option>
          {all.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <ConversionFunnel restaurantIds={rid ? [rid] : all.map((r) => r.id)} names={rid ? undefined : names} />
    </div>
  );
}
