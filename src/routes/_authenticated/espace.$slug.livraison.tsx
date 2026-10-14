import { RestaurantGuard, RestaurantNav } from "@/components/RestaurantGuard";
import { FeatureGate } from "@/components/FeatureGate";
import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Bike, Copy, ExternalLink, Circle, Hexagon, KeyRound, MapPin, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/lib/brand";
import { Crumbs } from "@/components/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";
import { supabase } from "@/integrations/supabase/client";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { courierPinStatus, saveDeliveryCapacity, saveDeliveryZones, setCourierPin } from "@/lib/delivery.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import type { GeoZone, LatLng } from "@/lib/geo";
import { capacityOf, fmtTime } from "@/lib/shop";
import { DriverSelect, useDrivers } from "@/components/DriverSelect";

const ZoneMap = lazy(() => import("@/components/ZoneMap"));
const DEFAULT_CENTER: LatLng = [43.6112, 1.3353];

export const Route = createFileRoute("/_authenticated/espace/$slug/livraison")({
  head: () => ({
    meta: [
      { title: "Livraison & livreurs — LC Digitale" },
      { name: "description", content: "Dessinez vos zones de livraison sur la carte et suivez vos livreurs." },
      { property: "og:title", content: "Livraison & livreurs" },
      { property: "og:description", content: "Zones par rayon ou polygone, frais et suivi des livraisons." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RestaurantGuard level="manager"><Gated /></RestaurantGuard>,
});

type Tool = "none" | "center" | "origin" | "polygon";
type Del = { id: string; order_number: number; customer_name: string; phone: string; address: string | null; postal_code: string | null; city: string | null; slot: string; status: string; total: number; payment_method: string; payment_status: string; delivery_lat: number | null; delivery_lng: number | null; courier_status: string | null; courier_name: string | null; zone_name: string | null; driver_id: string | null };
type St = "waiting" | "ready" | "en_route" | "delivered";
const ST: Record<St, { label: string; color: string; dot: string }> = {
  waiting: { label: "En attente / À préparer", color: "#f59e0b", dot: "bg-[#f59e0b]" },
  ready: { label: "Prête / Assignée", color: "#2563eb", dot: "bg-[#2563eb]" },
  en_route: { label: "En route", color: "#7c3aed", dot: "bg-[#7c3aed]" },
  delivered: { label: "Livrée", color: "#16a34a", dot: "bg-[#16a34a]" },
};
const stateOf = (o: Del): St => o.courier_status === "delivered" || o.status === "done" ? "delivered" : o.courier_status === "en_route" ? "en_route" : o.status === "ready" || o.courier_status === "assigned" ? "ready" : "waiting";
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fullAddr = (o: Del) => [o.address, [o.postal_code, o.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
const uid = () => Math.random().toString(36).slice(2, 10);
const COURIER: Record<string, string> = { assigned: "Assignée", en_route: "En cours", delivered: "Livrée" };

function Page() {
  const { slug } = Route.useParams();
  const { restaurants, loading } = useStaff();
  const me = restaurants.find((x) => x.slug === slug);
  const canManage = me?.role === "agency" || me?.role === "manager";
  const load = useServerFn(loadRestaurantAdmin);
  const save = useServerFn(saveDeliveryZones);
  const pinStatus = useServerFn(courierPinStatus);
  const savePin = useServerFn(setCourierPin);
  const { data: r, refetch } = useQuery({ queryKey: ["delivery-admin", slug], queryFn: () => load({ data: { slug } }), enabled: canManage });
  const { data: pin, refetch: refetchPin } = useQuery({ queryKey: ["courier-pin", r?.id], queryFn: () => pinStatus({ data: { restaurantId: r?.id ?? "" } }), enabled: !!r });
  const [zones, setZones] = useState<GeoZone[]>([]);
  const [origin, setOrigin] = useState<LatLng>(DEFAULT_CENTER);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [busy, setBusy] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [orders, setOrders] = useState<Del[]>([]);
  const drivers = useDrivers(r?.id);
  const [drvName, setDrvName] = useState("");

  useEffect(() => { if (r) { setZones(r.delivery.geoZones ?? []); setOrigin(r.delivery.origin ?? DEFAULT_CENTER); } }, [r]);
  useEffect(() => {
    if (!r) return;
    const since = new Date(Date.now() - 12 * 3600_000).toISOString();
    const fetchO = async () => {
      const { data, error } = await supabase.from("orders").select("id, order_number, customer_name, phone, address, postal_code, city, slot, status, total, payment_method, payment_status, delivery_lat, delivery_lng, courier_status, courier_name, zone_name, driver_id").eq("restaurant_id", r.id).eq("mode", "delivery").gte("created_at", since).not("status", "in", "(awaiting_payment,cancelled,rejected)").order("slot");
      if (error) { toast.error("Livraisons indisponibles"); return; } setOrders((data ?? []) as Del[]);
    };
    fetchO();
    const ch = supabase.channel(`deliv-${r.id}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${r.id}` }, fetchO).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [r]);

  const z = zones.find((x) => x.id === sel);
  const patch = (p: Partial<GeoZone>) => setZones((zs) => zs.map((x) => (x.id === sel ? { ...x, ...p } : x)));
  const add = (type: GeoZone["type"]) => {
    const nz: GeoZone = { id: uid(), name: type === "circle" ? `Rayon ${zones.length + 1}` : `Quartier ${zones.length + 1}`, type, minOrder: 15, fee: 2.5, freeFrom: 40, tiers: [], ...(type === "circle" ? { center: origin, radiusKm: 3 } : { points: [] }) };
    setZones([...zones, nz]); setSel(nz.id); setTool(type === "circle" ? "center" : "polygon"); setDraft([]);
  };
  const onMapClick = (p: LatLng) => {
    if (tool === "origin") { setOrigin(p); setTool("none"); toast.success("Position du restaurant placée"); return; }
    if (!z) return;
    if (tool === "center" && z.type === "circle") patch({ center: p });
    if (tool === "polygon" && z.type === "polygon") patch({ points: [...(z.points ?? []), p] });
  };
  const markers = useMemo(() => [], []);
  const saveCap = useServerFn(saveDeliveryCapacity);
  const [cap, setCap] = useState(() => capacityOf({ delivery: { minOrder: 0, fee: 0, freeFrom: 0, zones: [] } }));
  useEffect(() => { if (r) setCap(capacityOf(r)); }, [r]);
  const [filter, setFilter] = useState<"all" | "active">("active");
  const [focus, setFocus] = useState<string | null>(null);
  const counts = useMemo(() => { const c: Record<St, number> = { waiting: 0, ready: 0, en_route: 0, delivered: 0 }; orders.forEach((o) => { c[stateOf(o)]++; }); return c; }, [orders]);
  const shown = useMemo(() => orders.filter((o) => filter === "all" || stateOf(o) !== "delivered"), [orders, filter]);
  const liveMarkers = useMemo(() => shown.filter((o) => o.delivery_lat != null && o.delivery_lng != null).map((o) => {
    const st = stateOf(o), a = fullAddr(o), q = encodeURIComponent(a);
    const nav = `${o.delivery_lat},${o.delivery_lng}`;
    return { id: o.id, at: [o.delivery_lat!, o.delivery_lng!] as LatLng, color: ST[st].color, label: `n°${o.order_number} · ${ST[st].label}`,
      popup: `<strong>Commande n°${o.order_number}</strong> — ${esc(ST[st].label)}<br>${esc(o.customer_name)} · ${esc(o.phone)}<br>${esc(a)}<br>Créneau ${fmtTime(o.slot)} · ${Number(o.total).toFixed(2)} € · ${o.payment_status === "paid" ? "payé en ligne" : "à encaisser"}<br>Livreur : ${esc(o.courier_name ?? "non assigné")}<br><a href="https://waze.com/ul?ll=${nav}&navigate=yes" target="_blank" rel="noreferrer">Waze</a> · <a href="https://www.google.com/maps/dir/?api=1&destination=${q || nav}" target="_blank" rel="noreferrer">Google Maps</a>` };
  }), [shown]);
  const focused = orders.find((o) => o.id === focus);

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-[420px] w-full" /></div>;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;

  const submit = async () => {
    if (!r) return;
    setBusy(true);
    try { await save({ data: { restaurantId: r.id, zones, origin } }); await refetch(); toast.success("Zones enregistrées"); }
    catch (e) { toast.error(e instanceof Error ? e.message.replace(/^\[.*?"message":\s*"([^"]+)".*$/s, "$1") : "Erreur"); }
    finally { setBusy(false); }
  };
  const num = (v: string) => Math.max(0, Math.round((Number(v.replace(",", ".")) || 0) * 100) / 100);
  const courierUrl = typeof window !== "undefined" ? `${window.location.origin}/livreur?r=${slug}` : `/livreur?r=${slug}`;

  return (
    <div className="mx-auto max-w-6xl p-4 pb-20 sm:p-6">
      <div className="flex items-center justify-between gap-3"><Crumbs slug={slug} page="Livraison" /><ThemeToggle /></div>
      <RestaurantNav slug={slug} className="print:hidden" />
      <header className="mt-4 flex items-center gap-4"><BrandLogo src={r?.logo_url} name={r?.name ?? "Restaurant"} className="h-14 w-14 rounded-lg object-contain" /><div><p className="text-sm text-muted-foreground">{r?.name}</p><h1 className="text-4xl sm:text-5xl">Livraison & livreurs</h1></div></header>
      <p className="text-sm text-muted-foreground">Dessinez vos zones sur la carte. Dès qu'une zone existe, le client vérifie son adresse et l'éligibilité est calculée automatiquement (les codes postaux des Réglages ne servent plus).</p>

      <Tabs defaultValue="live" className="mt-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="live" className="min-h-11">Carte en direct des livraisons</TabsTrigger>
          <TabsTrigger value="zones" className="min-h-11">Zones & Tarifs</TabsTrigger>
          <TabsTrigger value="team" className="min-h-11">Équipe & Livreurs</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} className="min-h-11" onClick={() => setFilter("all")}>Toutes ({orders.length})</Button>
            <Button variant={filter === "active" ? "default" : "outline"} className="min-h-11" onClick={() => setFilter("active")}>En cours / À livrer ({orders.length - counts.delivered})</Button>
            {(Object.keys(ST) as St[]).map((k) => <span key={k} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs"><span className={`h-3 w-3 rounded-full ${ST[k].dot}`} />{ST[k].label} · <strong>{counts[k]}</strong></span>)}
          </div>
          <ClientOnly fallback={<Skeleton className="h-[460px] w-full" />}>
            <Suspense fallback={<Skeleton className="h-[460px] w-full" />}>
              <ZoneMap center={origin} zones={zones} markers={liveMarkers} onMarkerClick={setFocus} className="h-[460px] w-full rounded-xl border border-border" />
            </Suspense>
          </ClientOnly>
          {shown.some((o) => o.delivery_lat == null) && <p className="text-xs text-muted-foreground">{shown.filter((o) => o.delivery_lat == null).length} livraison(s) sans position GPS : visibles uniquement dans la liste.</p>}
          {focused && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-card p-3 text-sm">
              <span><strong>n°{focused.order_number}</strong> · {focused.customer_name} · {fmtTime(focused.slot)}<br /><span className="text-muted-foreground">{fullAddr(focused)}</span></span>
              <DriverSelect orderId={focused.id} driverId={focused.driver_id} drivers={drivers} courierStatus={focused.courier_status} />
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-2xl">Livraisons du jour</h2>
          {!shown.length ? <p className="mt-2 text-sm text-muted-foreground">Aucune livraison pour le moment.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {shown.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <button type="button" className="text-left" onClick={() => setFocus(o.id)}><span className={`mr-2 inline-block h-3 w-3 rounded-full ${ST[stateOf(o)].dot}`} /><strong>n°{o.order_number}</strong> · {fmtTime(o.slot)} · {o.customer_name}<br /><span className="text-muted-foreground">{fullAddr(o)}{o.zone_name ? ` · ${o.zone_name}` : ""}</span></button>
                  <span className="flex flex-wrap items-center gap-2"><DriverSelect orderId={o.id} driverId={o.driver_id} drivers={drivers} courierStatus={o.courier_status} />
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{ST[stateOf(o)].label}{o.courier_name ? ` · ${o.courier_name}` : ""}</span></span>
                </li>
              ))}
            </ul>
          )}
          </div>
        </TabsContent>
        <TabsContent value="zones">
      <section className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-2xl">Capacité par créneau</h2><Switch checked={cap.enabled} onCheckedChange={(v) => setCap({ ...cap, enabled: v })} aria-label="Limiter les livraisons par créneau" /></div>
        <p className="text-sm text-muted-foreground">Au-delà du plafond, le créneau s'affiche « Complet » pour la livraison ; le retrait reste possible.</p>
        {cap.enabled && <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="cs">Durée du créneau</Label><select id="cs" value={cap.slotMinutes} onChange={(e) => setCap({ ...cap, slotMinutes: Number(e.target.value) as 15 | 20 | 30 })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2">{[15, 20, 30].map((m) => <option key={m} value={m}>{m} min</option>)}</select></div>
          <div><Label htmlFor="cm">Calcul</Label><select id="cm" value={cap.mode} onChange={(e) => setCap({ ...cap, mode: e.target.value as "fixed" | "per_driver" })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2"><option value="fixed">Plafond fixe</option><option value="per_driver">Par livreur actif</option></select></div>
          {cap.mode === "fixed"
            ? <div><Label htmlFor="cx">Livraisons max / créneau</Label><Input id="cx" inputMode="numeric" value={cap.max} onChange={(e) => setCap({ ...cap, max: Math.max(1, Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 1)) })} /></div>
            : <div><Label htmlFor="cp">Courses / livreur / créneau</Label><Input id="cp" inputMode="numeric" value={cap.perDriver} onChange={(e) => setCap({ ...cap, perDriver: Math.max(1, Math.min(20, Number(e.target.value.replace(/\D/g, "")) || 1)) })} /><p className="mt-1 text-xs text-muted-foreground">{drivers.filter((d) => d.active).length} livreur(s) actif(s) → {cap.perDriver * drivers.filter((d) => d.active).length} livraisons max</p></div>}
        </div>}
        <Button className="min-h-11" disabled={!r} onClick={async () => { try { await saveCap({ data: { restaurantId: r!.id, capacity: cap } }); await refetch(); toast.success("Capacité enregistrée"); } catch (e) { toast.error((e as Error).message); } }}><Save /> Enregistrer la capacité</Button>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" className="min-h-12" onClick={() => add("circle")}><Circle /> Zone rayon</Button>
        <Button variant="secondary" className="min-h-12" onClick={() => add("polygon")}><Hexagon /> Zone dessinée</Button>
        <Button variant={tool === "origin" ? "default" : "ghost"} className="min-h-12" onClick={() => setTool(tool === "origin" ? "none" : "origin")}><MapPin /> Placer le restaurant</Button>
        <Button className="min-h-12" onClick={submit} disabled={busy}><Save /> {busy ? "Enregistrement…" : "Enregistrer les zones"}</Button>
      </div>
      {tool !== "none" && <p role="status" className="mt-2 rounded-lg bg-primary/10 p-2 text-sm">{tool === "origin" ? "Cliquez sur la carte à l'emplacement du restaurant." : tool === "center" ? "Cliquez sur la carte pour placer le centre, puis réglez le rayon." : "Cliquez point par point pour tracer la zone (3 points minimum)."}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ClientOnly fallback={<Skeleton className="h-[420px] w-full" />}>
          <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
            <ZoneMap center={origin} zones={zones} selectedId={sel} draft={draft} markers={markers} onMapClick={onMapClick} />
          </Suspense>
        </ClientOnly>

        <aside className="space-y-3">
          {!zones.length && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune zone : la livraison utilise encore la liste de codes postaux des Réglages.</p>}
          <ul className="space-y-2">
            {zones.map((x, i) => (
              <li key={x.id}>
                <button onClick={() => { setSel(x.id); setTool(x.type === "circle" ? "center" : "polygon"); }} className={`flex min-h-12 w-full items-center justify-between rounded-lg border px-3 text-left ${x.id === sel ? "border-primary bg-primary/10" : "border-border"}`}>
                  <span>{i + 1}. {x.name}</span><span className="text-xs text-muted-foreground">{x.type === "circle" ? `${x.radiusKm} km` : `${x.points?.length ?? 0} pts`} · {x.fee} €</span>
                </button>
              </li>
            ))}
          </ul>
          {z && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div><Label htmlFor="zn">Nom de la zone</Label><Input id="zn" value={z.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} /></div>
              {z.type === "circle" && (
                <div><Label>Rayon : {z.radiusKm} km</Label><Slider className="mt-3" min={0.5} max={20} step={0.5} value={[z.radiusKm ?? 3]} onValueChange={([v]) => patch({ radiusKm: v ?? 3 })} /></div>
              )}
              {z.type === "polygon" && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="min-h-11" disabled={!z.points?.length} onClick={() => patch({ points: (z.points ?? []).slice(0, -1) })}><Undo2 /> Annuler le dernier point</Button>
                  <Button variant="ghost" size="sm" className="min-h-11" onClick={() => patch({ points: [] })}>Effacer</Button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div><Label htmlFor="zm">Minimum €</Label><Input id="zm" inputMode="decimal" value={z.minOrder} onChange={(e) => patch({ minOrder: num(e.target.value) })} /></div>
                <div><Label htmlFor="zf">Frais €</Label><Input id="zf" inputMode="decimal" value={z.fee} onChange={(e) => patch({ fee: num(e.target.value) })} /></div>
                <div><Label htmlFor="zo">Offerte dès €</Label><Input id="zo" inputMode="decimal" value={z.freeFrom} onChange={(e) => patch({ freeFrom: num(e.target.value) })} /></div>
              </div>
              <div>
                <p className="text-sm font-semibold">Frais dégressifs</p>
                {(z.tiers ?? []).map((t, i) => (
                  <div key={i} className="mt-2 flex items-center gap-2 text-sm">
                    dès <Input className="w-20" inputMode="decimal" value={t.from} onChange={(e) => patch({ tiers: (z.tiers ?? []).map((x, j) => (j === i ? { ...x, from: num(e.target.value) } : x)) })} aria-label="À partir de (€)" />
                    € → <Input className="w-20" inputMode="decimal" value={t.fee} onChange={(e) => patch({ tiers: (z.tiers ?? []).map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)) })} aria-label="Frais (€)" /> €
                    <Button size="icon" variant="ghost" onClick={() => patch({ tiers: (z.tiers ?? []).filter((_, j) => j !== i) })} aria-label="Supprimer le palier"><Trash2 /></Button>
                  </div>
                ))}
                {(z.tiers?.length ?? 0) < 5 && <Button variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => patch({ tiers: [...(z.tiers ?? []), { from: 25, fee: 1.5 }] })}><Plus /> Ajouter un palier</Button>}
              </div>
              <Button variant="destructive" className="min-h-11 w-full" onClick={() => { setZones(zones.filter((x) => x.id !== z.id)); setSel(null); setTool("none"); }}><Trash2 /> Supprimer la zone</Button>
            </section>
          )}
        </aside>
      </div>

        </TabsContent>
        <TabsContent value="team">
      <section className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-2xl"><KeyRound className="h-5 w-5 text-primary" /> Accès livreurs</h2>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" asChild className="min-h-12"><a href={courierUrl} target="_blank" rel="noreferrer"><ExternalLink /> Ouvrir l’accès</a></Button><Button variant="outline" className="min-h-12" onClick={async () => { try { await navigator.clipboard.writeText(courierUrl); toast.success("Lien copié"); } catch { toast.error("Copie indisponible"); } }}><Copy /> Copier le lien</Button></div>
          <p className="text-sm">{pin?.enabled ? "Code actif." : "Aucun code : l'écran livreur est fermé."}</p>
          <div className="flex gap-2">
            <Input inputMode="numeric" maxLength={6} placeholder="4 à 6 chiffres" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} aria-label="Nouveau code livreur" />
            <Button className="min-h-11" disabled={!/^\d{4,6}$/.test(newPin) || !r} onClick={async () => { try { await savePin({ data: { restaurantId: r?.id ?? "", pin: newPin } }); setNewPin(""); refetchPin(); toast.success("Code livreur enregistré"); } catch (e) { toast.error((e as Error).message); } }}>Définir</Button>
          </div>
          {pin?.enabled && <Button variant="ghost" className="min-h-11" onClick={async () => { await savePin({ data: { restaurantId: r?.id ?? "", pin: null } }); refetchPin(); toast.success("Écran livreur fermé"); }}>Désactiver le code</Button>}
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-2xl"><Bike className="text-primary" /> Équipe de livraison</h2>
          {!drivers.length && <p className="text-sm text-muted-foreground">Aucun livreur enregistré.</p>}
          <ul className="divide-y divide-border">
            {drivers.map((d) => (
              <li key={d.id} className="flex min-h-12 items-center justify-between gap-2">
                <span>{d.name}<span className="ml-2 text-xs text-muted-foreground">{d.active ? "Actif" : "Inactif"}</span></span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={async () => { const { error } = await supabase.from("restaurant_drivers").update({ active: !d.active }).eq("id", d.id); if (error) toast.error("Modification impossible"); else toast.success(d.active ? "Livreur désactivé" : "Livreur réactivé"); }}>{d.active ? "Désactiver" : "Réactiver"}</Button>
                  <Button size="icon" variant="ghost" aria-label={`Supprimer ${d.name}`} onClick={async () => { if (confirm(`Supprimer ${d.name} ?`)) { const { error } = await supabase.from("restaurant_drivers").delete().eq("id", d.id); if (error) toast.error("Suppression impossible"); else toast.success("Livreur supprimé"); } }}><Trash2 /></Button>
                </span>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!r || drvName.trim().length < 2) return; const { error } = await supabase.from("restaurant_drivers").insert({ restaurant_id: r.id, name: drvName.trim().slice(0, 40) }); if (error) toast.error("Ajout impossible"); else setDrvName(""); }}>
            <Input placeholder="Prénom du livreur" value={drvName} maxLength={40} onChange={(e) => setDrvName(e.target.value)} aria-label="Prénom du livreur" />
            <Button type="submit" className="min-h-12" disabled={drvName.trim().length < 2}><Plus /> Ajouter</Button>
          </form>
        </div>
      </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Gated() {
  const { slug } = Route.useParams();
  return <FeatureGate slug={slug} feature="livraison"><Page /></FeatureGate>;
}
