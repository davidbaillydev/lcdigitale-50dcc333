import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Circle, Hexagon, KeyRound, MapPin, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
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
import { courierPinStatus, saveDeliveryZones, setCourierPin } from "@/lib/delivery.functions";
import type { GeoZone, LatLng } from "@/lib/geo";
import { fmtTime } from "@/lib/shop";
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
  component: Page,
});

type Tool = "none" | "center" | "origin" | "polygon";
type Del = { id: string; order_number: number; customer_name: string; address: string | null; slot: string; status: string; courier_status: string | null; courier_name: string | null; zone_name: string | null; driver_id: string | null };
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
  const { data: pin, refetch: refetchPin } = useQuery({ queryKey: ["courier-pin", r?.id], queryFn: () => pinStatus({ data: { restaurantId: r!.id } }), enabled: !!r });
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
      const { data } = await supabase.from("orders").select("id, order_number, customer_name, address, slot, status, courier_status, courier_name, zone_name, driver_id").eq("restaurant_id", r.id).eq("mode", "delivery").gte("created_at", since).neq("status", "awaiting_payment").order("slot");
      setOrders((data ?? []) as Del[]);
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
      <h1 className="mt-4 text-4xl sm:text-5xl">Livraison · {r?.name}</h1>
      <p className="text-sm text-muted-foreground">Dessinez vos zones sur la carte. Dès qu'une zone existe, le client vérifie son adresse et l'éligibilité est calculée automatiquement (les codes postaux des Réglages ne servent plus).</p>

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
                  <Button variant="ghost" size="sm" className="min-h-11" disabled={!z.points?.length} onClick={() => patch({ points: z.points!.slice(0, -1) })}><Undo2 /> Annuler le dernier point</Button>
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
                    dès <Input className="w-20" inputMode="decimal" value={t.from} onChange={(e) => patch({ tiers: z.tiers!.map((x, j) => (j === i ? { ...x, from: num(e.target.value) } : x)) })} aria-label="À partir de (€)" />
                    € → <Input className="w-20" inputMode="decimal" value={t.fee} onChange={(e) => patch({ tiers: z.tiers!.map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)) })} aria-label="Frais (€)" /> €
                    <Button size="icon" variant="ghost" onClick={() => patch({ tiers: z.tiers!.filter((_, j) => j !== i) })} aria-label="Supprimer le palier"><Trash2 /></Button>
                  </div>
                ))}
                {(z.tiers?.length ?? 0) < 5 && <Button variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => patch({ tiers: [...(z.tiers ?? []), { from: 25, fee: 1.5 }] })}><Plus /> Ajouter un palier</Button>}
              </div>
              <Button variant="destructive" className="min-h-11 w-full" onClick={() => { setZones(zones.filter((x) => x.id !== z.id)); setSel(null); setTool("none"); }}><Trash2 /> Supprimer la zone</Button>
            </section>
          )}
        </aside>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-2xl"><KeyRound className="h-5 w-5 text-primary" /> Accès livreurs</h2>
          <p className="text-sm text-muted-foreground">Les livreurs ouvrent <strong className="break-all">{courierUrl}</strong> sur leur téléphone et saisissent ce code.</p>
          <p className="text-sm">{pin?.enabled ? "Code actif." : "Aucun code : l'écran livreur est fermé."}</p>
          <div className="flex gap-2">
            <Input inputMode="numeric" maxLength={6} placeholder="4 à 6 chiffres" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} aria-label="Nouveau code livreur" />
            <Button className="min-h-11" disabled={!/^\d{4,6}$/.test(newPin) || !r} onClick={async () => { try { await savePin({ data: { restaurantId: r!.id, pin: newPin } }); setNewPin(""); refetchPin(); toast.success("Code livreur enregistré"); } catch (e) { toast.error((e as Error).message); } }}>Définir</Button>
          </div>
          {pin?.enabled && <Button variant="ghost" className="min-h-11" onClick={async () => { await savePin({ data: { restaurantId: r!.id, pin: null } }); refetchPin(); toast.success("Écran livreur fermé"); }}>Désactiver le code</Button>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-2xl">Livraisons du jour</h2>
          {!orders.length ? <p className="mt-2 text-sm text-muted-foreground">Aucune livraison pour le moment.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><strong>n°{o.order_number}</strong> · {fmtTime(o.slot)} · {o.customer_name}<br /><span className="text-muted-foreground">{o.address}{o.zone_name ? ` · ${o.zone_name}` : ""}</span></span>
                  <span className="flex flex-wrap items-center gap-2">{o.status !== "cancelled" && <DriverSelect orderId={o.id} driverId={o.driver_id} drivers={drivers} courierStatus={o.courier_status} />}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${o.courier_status === "delivered" ? "bg-primary/15 text-primary" : o.courier_status ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {o.status === "cancelled" ? "Annulée" : o.courier_status ? `${COURIER[o.courier_status]}${o.courier_name ? ` · ${o.courier_name}` : ""}` : "À attribuer"}
                  </span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 md:col-start-1">
          <h2 className="text-2xl">Livreurs</h2>
          <ul className="divide-y divide-border">
            {drivers.map((d) => (
              <li key={d.id} className="flex min-h-12 items-center justify-between gap-2">
                <span className={d.active ? "" : "text-muted-foreground line-through"}>{d.name}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={async () => { await supabase.from("restaurant_drivers").update({ active: !d.active }).eq("id", d.id); }}>{d.active ? "Désactiver" : "Réactiver"}</Button>
                  <Button size="icon" variant="ghost" aria-label={`Supprimer ${d.name}`} onClick={async () => { if (confirm(`Supprimer ${d.name} ?`)) await supabase.from("restaurant_drivers").delete().eq("id", d.id); }}><Trash2 /></Button>
                </span>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!r || drvName.trim().length < 2) return; const { error } = await supabase.from("restaurant_drivers").insert({ restaurant_id: r.id, name: drvName.trim().slice(0, 40) }); if (error) toast.error("Ajout impossible"); else setDrvName(""); }}>
            <Input placeholder="Prénom du livreur" value={drvName} maxLength={40} onChange={(e) => setDrvName(e.target.value)} aria-label="Prénom du livreur" />
            <Button type="submit" className="min-h-11"><Plus /> Ajouter</Button>
          </form>
        </div>
      </section>
    </div>
  );
}
