import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/lib/theme";
import { downloadCSV, downloadXLSX } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  head: () => ({
    meta: [
      { title: "Clients de tous les restaurants — Console agence" },
      { name: "description", content: "Vue agence consolidée des fichiers clients, par établissement." },
      { property: "og:title", content: "Clients — Console agence" },
      { property: "og:description", content: "Fichiers clients consolidés, réservés à l'agence." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Row = { id: string; restaurant_id: string; name: string | null; email: string | null; phone: string | null; marketing_consent: boolean; source: string; created_at: string };
const SRC: Record<string, string> = { import: "Fichier importé", order: "Commande en ligne", reservation: "Réservation", manual: "Manuel" };

function Page() {
  const [q, setQ] = useState("");
  const [rid, setRid] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["agency-customers"],
    queryFn: async () => {
      const { data: rs, error: e1 } = await supabase.from("restaurants").select("id, slug, name").order("name");
      if (e1) throw e1;
      const rows: Row[] = [];
      for (let i = 0; ; i += 1000) {
        const { data: c, error } = await supabase.from("restaurant_customers").select("id, restaurant_id, name, email, phone, marketing_consent, source, created_at").order("created_at", { ascending: false }).range(i, i + 999);
        if (error) throw error;
        rows.push(...(c ?? []));
        if (!c || c.length < 1000) break;
      }
      return { restaurants: rs ?? [], rows };
    },
  });
  const byId = useMemo(() => new Map((data?.restaurants ?? []).map((r) => [r.id, r])), [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter((c) => (!rid || c.restaurant_id === rid) && (!q || `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [data, q, rid]);
  const counts = useMemo(() => { const m = new Map<string, number>(); (data?.rows ?? []).forEach((c) => m.set(c.restaurant_id, (m.get(c.restaurant_id) ?? 0) + 1)); return m; }, [data]);
  const exp = () => rows.map((c) => ({ Restaurant: byId.get(c.restaurant_id)?.name ?? "", Nom: c.name ?? "", Email: c.email ?? "", Téléphone: c.phone ?? "", Consentement: c.marketing_consent ? "Oui" : "Non", Origine: SRC[c.source] ?? c.source, Créé: new Date(c.created_at).toLocaleDateString("fr-FR") }));

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <Crumbs page="Clients" />
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold">Clients — tous les restaurants</h1>
      <p className="text-sm text-muted-foreground">Vue réservée à l'agence. Chaque restaurateur ne voit que les clients de son établissement. Les fiches se complètent automatiquement à l'ouverture de la page Clients de chaque restaurant (commandes et réservations).</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.restaurants ?? []).map((r) => (
          <Link key={r.id} to="/espace/$slug/clients" params={{ slug: r.slug }} className="rounded-lg border border-border bg-card p-4 transition hover:border-primary">
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-muted-foreground">{counts.get(r.id) ?? 0} client(s) — ouvrir et synchroniser</div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Rechercher nom, email, téléphone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select value={rid} onChange={(e) => setRid(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Tous les restaurants</option>
          {(data?.restaurants ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Button variant="secondary" onClick={() => downloadCSV("clients-agence", exp())} disabled={!rows.length}><FileDown /> CSV</Button>
        <Button variant="secondary" onClick={() => downloadXLSX("clients-agence", { Clients: exp() })} disabled={!rows.length}><FileSpreadsheet /> Excel</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : error ? <p className="text-destructive">Impossible de charger les clients.</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-3">Restaurant</th><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Téléphone</th><th className="p-3">Origine</th><th className="p-3">Consentement</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">{byId.get(c.restaurant_id)?.name}</td><td className="p-3">{c.name ?? "—"}</td><td className="p-3">{c.email ?? "—"}</td><td className="p-3">{c.phone ?? "—"}</td><td className="p-3">{SRC[c.source] ?? c.source}</td><td className="p-3">{c.marketing_consent ? "Oui" : "Non"}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun client.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
