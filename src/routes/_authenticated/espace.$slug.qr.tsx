import { FeatureGate } from "@/components/FeatureGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";
import { loadRestaurantAdmin, saveQrSettings } from "@/lib/restaurant-settings.functions";

/** QR code PNG haute définition avec le logo du restaurant au centre (correction d'erreur H). */
async function qrPng(url: string, color: string, logo?: string | null): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, { width: 800, margin: 2, errorCorrectionLevel: "H", color: { dark: color, light: "#ffffff" } });
  if (logo) {
    try {
      const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = logo; });
      const ctx = canvas.getContext("2d")!; const s = canvas.width * 0.22; const x = (canvas.width - s) / 2;
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(x - 12, x - 12, s + 24, s + 24, 16); ctx.fill();
      const k = Math.min(s / img.width, s / img.height); const w = img.width * k, h = img.height * k;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      canvas.toDataURL();
    } catch { await QRCode.toCanvas(canvas, url, { width: 800, margin: 2, errorCorrectionLevel: "H", color: { dark: color, light: "#ffffff" } }); }
  }
  return canvas.toDataURL("image/png");
}
const download = (png: string, name: string) => { const a = document.createElement("a"); a.href = png; a.download = name; a.click(); };

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
  component: Gated,
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
  const [room, setRoom] = useState(false);
  const [self, setSelf] = useState(false);
  const [tableValidation, setTableValidation] = useState(false);
  const [roomNo, setRoomNo] = useState("101");
  const [extra, setExtra] = useState<{ t: string; d: string; url: string; svg: string }[]>([]);
  const [codes, setCodes] = useState<{ n: number; url: string; svg: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (r) { setTables(r.config.qr?.tables ?? 0); setReviewUrl(r.config.qr?.reviewUrl ?? ""); setRoom(!!r.config.qr?.room); setSelf(!!r.config.qr?.self); setTableValidation(!!r.config.qr?.tableValidation); } }, [r]);
  useEffect(() => {
    if (!r) return;
    const color = r.brand?.primary && /^#[0-9a-f]{6}$/i.test(r.brand.primary) ? r.brand.primary : "#222029";
    const base = `${window.location.origin}/${r.slug}`;
    const list = [
      ...(r.config.qr?.room && /^[A-Za-z0-9-]{1,8}$/.test(roomNo) ? [{ t: `Room service · Chambre ${roomNo}`, d: "Le numéro de chambre est joint à la commande.", url: `${base}?room=${roomNo}` }] : []),
      ...(r.config.qr?.self ? [{ t: "Libre-service", d: "Commande validée par le personnel avant la cuisine.", url: `${base}?qr=self` }] : []),
      { t: "Consultation seule", d: "Menu vitrine, sans commande.", url: `${base}?qr=view` },
    ];
    Promise.all(list.map(async (x) => ({ ...x, svg: await qrPng(x.url, color, r.logo_url) }))).then(setExtra);
  }, [r, roomNo]);
  useEffect(() => {
    const saved = r?.config.qr?.tables ?? 0;
    if (!r || !saved) { setCodes([]); return; }
    const color = r.brand?.primary && /^#[0-9a-f]{6}$/i.test(r.brand.primary) ? r.brand.primary : "#222029";
    Promise.all(Array.from({ length: saved }, async (_, i) => {
      const url = `${window.location.origin}/${r.slug}?table=${i + 1}`;
      return { n: i + 1, url, svg: await qrPng(url, color, r.logo_url) };
    })).then(setCodes);
  }, [r]);

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;

  const submit = async () => {
    if (!r) return;
    setBusy(true);
    try { await save({ data: { restaurantId: r.id, tables, reviewUrl, room, self, tableValidation } }); await refetch(); toast.success("Réglages enregistrés"); }
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
      <section className="mt-4 rounded-xl border border-border bg-card p-4 print:hidden">
        <h2 className="text-2xl">Autres types de QR</h2>
        <label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={room} onChange={(e) => setRoom(e.target.checked)} /> Room service (hôtel) : le numéro de chambre est ajouté à la commande</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={self} onChange={(e) => setSelf(e.target.checked)} /> Libre-service : les commandes attendent la validation du personnel avant la cuisine</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={tableValidation} onChange={(e) => setTableValidation(e.target.checked)} /> Tables : validation par le serveur avant l'envoi en cuisine</label>
        <p className="text-sm text-muted-foreground">Le QR « Consultation seule » est toujours disponible (menu sans bouton de commande).</p>
        {r?.config.qr?.room && <div className="mt-3 max-w-xs"><Label htmlFor="roomno">Numéro de chambre pour le QR</Label><Input id="roomno" value={roomNo} onChange={(e) => setRoomNo(e.target.value.slice(0, 8))} /></div>}
        {extra.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {extra.map((x) => (
              <figure key={x.url} className="rounded-xl border border-border p-3 text-center">
                <p className="font-semibold">{x.t}</p>
                <img src={x.svg} alt={`QR ${x.t}`} className="mx-auto my-2 aspect-square w-full max-w-40 rounded bg-white" />
                <p className="text-xs text-muted-foreground">{x.d}</p>
                <div className="flex justify-center gap-1"><Button variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => { navigator.clipboard.writeText(x.url); toast.success("Lien copié"); }}>Copier le lien</Button><Button variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => download(x.svg, `qr-${x.t.replace(/\W+/g, "-")}.png`)}><Download /> PNG</Button></div>
              </figure>
            ))}
          </div>
        )}
      </section>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={submit} disabled={busy}><Save /> {busy ? "Enregistrement…" : "Enregistrer"}</Button>
        {codes.length > 0 && <Button variant="secondary" onClick={() => window.print()}><Printer /> Imprimer / exporter en PDF</Button>}
      </div>
      {codes.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:mt-0 print:grid-cols-3">
          {codes.map((c) => (
            <figure key={c.n} className="break-inside-avoid rounded-xl border border-border bg-card p-4 text-center print:border-black">
              <p className="text-sm font-semibold">{r?.name}</p>
              <img src={c.svg} alt={`QR table ${c.n}`} className="mx-auto my-2 aspect-square w-full max-w-44 rounded bg-white" />
              <figcaption className="text-2xl font-bold">Table {c.n}</figcaption>
              <p className="text-xs text-muted-foreground">Scannez pour voir la carte et commander</p>
              <Button variant="ghost" size="sm" className="min-h-11 print:hidden" onClick={() => download(c.svg, `qr-table-${c.n}.png`)}><Download /> PNG</Button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function Gated() {
  const { slug } = Route.useParams();
  return <FeatureGate slug={slug} feature="qrcode"><Page /></FeatureGate>;
}
