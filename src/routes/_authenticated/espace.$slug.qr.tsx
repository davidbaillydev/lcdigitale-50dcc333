import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";
import { loadRestaurantAdmin, saveQrSettings } from "@/lib/restaurant-settings.functions";

export const Route = createFileRoute("/_authenticated/espace/$slug/qr")({
  head: () => ({
    meta: [
      { title: "QR codes de table et avis Google — LC Digitale" },
      { name: "description", content: "Générez les QR codes de chaque table et demandez un avis Google après la commande." },
      { property: "og:title", content: "QR codes de table et avis Google" },
      { property: "og:description", content: "Menu QR par table et boost d'avis Google." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { restaurants, loading } = useStaff();
  const me = restaurants.find((x) => x.slug === slug);
  const canManage = me?.role === "agency" || me?.role === "manager";
  const load = useServerFn(loadRestaurantAdmin);
  const save = useServerFn(saveQrSettings);
  const { data: r, refetch } = useQuery({ queryKey: ["qr-admin", slug], queryFn: () => load({ data: { slug } }), enabled: canManage });
  const [tables, setTables] = useState(0);
  const [reviewUrl, setReviewUrl] = useState("");
  const [codes, setCodes] = useState<{ n: number; url: string; svg: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (r) { setTables(r.config.qr?.tables ?? 0); setReviewUrl(r.config.qr?.reviewUrl ?? ""); } }, [r]);
  useEffect(() => {
    const saved = r?.config.qr?.tables ?? 0;
    if (!r || !saved) { setCodes([]); return; }
    const color = r.brand?.primary && /^#[0-9a-f]{6}$/i.test(r.brand.primary) ? r.brand.primary : "#222029";
    Promise.all(Array.from({ length: saved }, async (_, i) => {
      const url = `${window.location.origin}/${r.slug}?table=${i + 1}`;
      return { n: i + 1, url, svg: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: color, light: "#ffffff" } }) };
    })).then(setCodes);
  }, [r]);

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;

  const submit = async () => {
    if (!r) return;
    setBusy(true);
    try { await save({ data: { restaurantId: r.id, tables, reviewUrl } }); await refetch(); toast.success("Réglages enregistrés"); }
    catch (e) { toast.error(e instanceof Error && /regex|https/i.test(e.message) ? "Le lien d'avis doit commencer par https://" : (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 pb-20">
      <div className="flex items-center justify-between gap-3 print:hidden"><Crumbs slug={slug} page="QR tables & avis" /><ThemeToggle /></div>
      <h1 className="mt-4 text-5xl print:hidden">QR codes · {r?.name}</h1>
      <div className="mt-6 grid gap-4 print:hidden md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-2xl">Menu QR par table</h2>
          <p className="text-sm text-muted-foreground">Chaque table reçoit son QR code. Les commandes arrivent en cuisine avec le numéro de table, préparation immédiate.</p>
          <Label htmlFor="tables" className="mt-3 block">Nombre de tables (0 = désactivé)</Label>
          <Input id="tables" type="number" min={0} max={300} value={tables} onChange={(e) => setTables(Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0))))} />
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-2xl"><Star className="h-5 w-5 text-primary" /> Boost d'avis Google</h2>
          <p className="text-sm text-muted-foreground">Une fois la commande prête, le client est invité à laisser un avis sur votre fiche Google.</p>
          <Label htmlFor="review" className="mt-3 block">Lien d'avis Google</Label>
          <Input id="review" type="url" placeholder="https://g.page/r/…/review" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} />
        </section>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={submit} disabled={busy}><Save /> {busy ? "Enregistrement…" : "Enregistrer"}</Button>
        {codes.length > 0 && <Button variant="secondary" onClick={() => window.print()}><Printer /> Imprimer les QR codes</Button>}
      </div>
      {codes.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:mt-0 print:grid-cols-3">
          {codes.map((c) => (
            <figure key={c.n} className="break-inside-avoid rounded-xl border border-border bg-card p-4 text-center print:border-black">
              <p className="text-sm font-semibold">{r?.name}</p>
              <div className="mx-auto my-2 aspect-square w-full max-w-44 rounded bg-white p-1" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <figcaption className="text-2xl font-bold">Table {c.n}</figcaption>
              <p className="text-xs text-muted-foreground">Scannez pour voir la carte et commander</p>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
