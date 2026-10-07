import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bike, CheckCircle2, KeyRound, LogOut, Navigation, Phone, RefreshCw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { BrandTheme, BrandLogo } from "@/lib/brand";
import { getRestaurant } from "@/lib/restaurants.functions";
import { ThemeToggle } from "@/lib/theme";
import { courierLogin, courierOrders, courierUpdate } from "@/lib/delivery.functions";
import { fmtTime } from "@/lib/shop";
import type { LatLng } from "@/lib/geo";

const ZoneMap = lazy(() => import("@/components/ZoneMap"));
const KEY = "lc-courier";

export const Route = createFileRoute("/livreur")({
  head: () => ({
    meta: [
      { title: "Espace livreur — LC Digitale" },
      { name: "description", content: "Livraisons à effectuer, guidage GPS et suivi des statuts pour les livreurs." },
      { property: "og:title", content: "Espace livreur" },
      { property: "og:description", content: "Liste des livraisons, GPS et statuts en un geste." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Courier,
});

type O = Awaited<ReturnType<typeof courierOrders>>[number];
type Session = { token: string; name: string; slug: string; me: string; driverId?: string | undefined };
type Drv = { id: string; name: string };
const err = (e: unknown) => (e instanceof Error ? e.message : "Erreur");

function Courier() {
  const [s, setS] = useState<Session | null>(null);
  const [slug, setSlug] = useState("");
  const get = useServerFn(getRestaurant);
  const { data: restaurant } = useQuery({ queryKey: ["courier-brand", s?.slug ?? slug], queryFn: () => get({ data: { slug: s?.slug ?? slug } }), enabled: !!(s?.slug ?? slug), staleTime: 15 * 60_000 });
  const [ready, setReady] = useState(false);
  useEffect(() => { setSlug(new URLSearchParams(window.location.search).get("r") ?? ""); try { const v = localStorage.getItem(KEY); if (v) setS(JSON.parse(v)); } catch {} setReady(true); }, []);
  const logout = useCallback(() => { localStorage.removeItem(KEY); setS(null); }, []);
  if (!ready) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  return (
    <BrandTheme brand={restaurant?.brand}><main className="courier-workspace min-h-screen bg-background text-foreground"><div className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between gap-3 border-b border-border pb-5"><div className="flex min-w-0 items-center gap-3"><BrandLogo src={restaurant?.logo_url} name={restaurant?.name ?? "Restaurant"} /><div className="min-w-0"><p className="text-xs font-semibold uppercase text-muted-foreground">Espace livraison</p><p className="break-words text-xl font-semibold">{restaurant?.name ?? "LC Digitale"}</p></div></div><ThemeToggle /></header>
      {s ? <Board s={s} onLogout={logout} /> : <Login slug={slug} onSlug={setSlug} onDone={(x) => { localStorage.setItem(KEY, JSON.stringify(x)); setS(x); }} />}
    </div></main></BrandTheme>
  );
}

function Login({ slug, onSlug, onDone }: { slug: string; onSlug: (slug: string) => void; onDone: (s: Session) => void }) {
  const login = useServerFn(courierLogin);
  const [pin, setPin] = useState("");
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ token: string; name: string; drivers: Drv[] } | null>(null);

  const go = async () => {
    setBusy(true);
    try { const r = await login({ data: { slug, pin } }); if (r.drivers.length) setPending(r); else onDone({ token: r.token, name: r.name, slug, me: me.trim() }); }
    catch (e) { toast.error(err(e)); setPin(""); } finally { setBusy(false); }
  };
  if (pending) return (
    <section className="mx-auto max-w-sm space-y-3">
      <h1 className="text-3xl">Choisir mon profil</h1>
      <Button variant="ghost" onClick={() => { setPending(null); setPin(""); }}><ArrowLeft /> Retour au code</Button>
      {pending.drivers.map((d) => <Button key={d.id} variant="secondary" className="min-h-14 w-full text-lg" onClick={() => onDone({ token: pending.token, name: pending.name, slug, me: d.name, driverId: d.id })}><UserRound />{d.name}</Button>)}
    </section>
  );
  return (
    <section className="mx-auto max-w-sm space-y-5">
      <h1 className="flex items-center gap-2 text-3xl"><KeyRound className="h-7 w-7 text-primary" /> Accès livreur</h1>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!busy && slug && pin.length >= 4) void go(); }}>
      <div><Label htmlFor="r">Restaurant</Label><Input id="r" value={slug} onChange={(e) => onSlug(e.target.value.trim().toLowerCase())} placeholder="identifiant du restaurant" /></div>

      <div><Label htmlFor="pin">Code livreur</Label><Input id="pin" inputMode="numeric" type="password" maxLength={6} className="h-14 text-center text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}  /></div>
      <Button className="min-h-14 w-full text-lg" disabled={busy || !slug || pin.length < 4} type="submit">{busy ? "Connexion…" : "Continuer"}</Button></form>
    </section>
  );
}

function Board({ s, onLogout }: { s: Session; onLogout: () => void }) {
  const list = useServerFn(courierOrders);
  const update = useServerFn(courierUpdate);
  const [orders, setOrders] = useState<O[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const refresh = useCallback(async () => {
    try { setOrders(await list({ data: { token: s.token, ...(s.driverId ? { driverId: s.driverId } : {}) } })); setUpdated(new Date()); }
    catch (e) { toast.error(err(e)); if (/Session|profil|Livreur/.test(err(e))) onLogout(); }
  }, [list, s.token, s.driverId, onLogout]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 10_000); return () => clearInterval(t); }, [refresh]);
  const step = async (o: O, st: "assigned" | "en_route" | "delivered") => {
    setBusy(o.id);
    try { await update({ data: { token: s.token, orderId: o.id, step: st, ...(s.driverId ? { driverId: s.driverId } : s.me ? { name: s.me } : {}) } }); await refresh(); }
    catch (e) { toast.error(err(e)); } finally { setBusy(null); }
  };
  const todo = (orders ?? []).filter((o) => o.courier_status !== "delivered");
  const done = (orders ?? []).filter((o) => o.courier_status === "delivered");
  const markers = useMemo(() => todo.filter((o) => o.delivery_lat != null).map((o) => ({ id: o.id, at: [o.delivery_lat, o.delivery_lng] as LatLng, label: `n°${o.order_number}` })), [todo]);
  const dest = (o: O) => o.delivery_lat != null ? `${o.delivery_lat},${o.delivery_lng}` : encodeURIComponent(`${o.address ?? ""} ${o.postal_code ?? ""} ${o.city ?? ""}`);

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0"><h1 className="text-3xl">{s.me || "Mes livraisons"}</h1><p className="text-sm text-muted-foreground">{todo.length} à livrer · {done.length} terminée(s)</p>{updated && <p role="status" className="text-xs text-muted-foreground">Actualisé à {updated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>}</div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-12 w-12" onClick={refresh} aria-label="Actualiser"><RefreshCw /></Button>
          <Button size="icon" variant="ghost" className="h-12 w-12" onClick={onLogout} aria-label="Se déconnecter"><LogOut /></Button>
        </div>
      </header>
      {markers.length > 0 && (
        <ClientOnly fallback={<Skeleton className="mt-3 h-56 w-full" />}>
          <Suspense fallback={<Skeleton className="mt-3 h-56 w-full" />}>
            <div className="mt-3"><ZoneMap center={markers[0]?.at ?? [43.6112, 1.3353]} markers={markers} className="h-56 w-full rounded-xl border border-border" /></div>
          </Suspense>
        </ClientOnly>
      )}
      {orders === null ? <Skeleton className="mt-4 h-40 w-full" /> : !todo.length ? <p className="mt-8 text-center text-muted-foreground">Aucune livraison en attente. La liste s'actualise toute seule.</p> : (
        <ul className="mt-4 space-y-3">
          {[...todo].sort((a, b) => Number(b.driver_id === s.driverId) - Number(a.driver_id === s.driverId)).map((o) => (
            <li key={o.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-2xl font-bold">n°{o.order_number} · {fmtTime(o.slot)}</p><p className="font-semibold">{o.customer_name}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.driverId && o.driver_id === s.driverId ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s.driverId && o.driver_id === s.driverId ? "Pour vous · " : ""}{o.courier_status === "en_route" ? "En cours" : o.courier_status === "assigned" ? "Assignée" : o.status === "ready" ? "Prête" : "En préparation"}</span>
              </div>
              <p className="mt-1">{o.address}{o.postal_code ? `, ${o.postal_code}` : ""}{o.city ? `, ${o.city}` : ""}</p>
              {o.notes && <p className="mt-1 text-sm text-muted-foreground">« {o.notes} »</p>}
              <p className="mt-1 text-sm">{Number(o.total).toFixed(2)} € · {o.payment_status === "paid" ? "Payée" : "À encaisser"}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button asChild variant="secondary" className="min-h-12"><a href={`https://www.google.com/maps/dir/?api=1&destination=${dest(o)}`} target="_blank" rel="noreferrer"><Navigation /> Maps</a></Button>
                <Button asChild variant="secondary" className="min-h-12"><a href={o.delivery_lat != null ? `https://waze.com/ul?ll=${dest(o)}&navigate=yes` : `https://waze.com/ul?q=${dest(o)}&navigate=yes`} target="_blank" rel="noreferrer"><Navigation /> Waze</a></Button>
                <Button asChild variant="secondary" className="min-h-12"><a href={`tel:${o.phone}`}><Phone /> Appeler</a></Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {o.courier_status !== "en_route"
                  ? <Button className="min-h-14 col-span-2" disabled={busy === o.id || o.status !== "ready"} onClick={() => step(o, "en_route")}><Bike /> {o.status === "ready" ? "Démarrer la livraison" : "En préparation en cuisine"}</Button>
                  : <Button className="min-h-14 col-span-2" disabled={busy === o.id} onClick={() => { if (window.confirm(`Confirmer la livraison de la commande n°${o.order_number} ?`)) void step(o, "delivered"); }}><CheckCircle2 /> Confirmer la remise</Button>}
                {!o.driver_id && !o.courier_status && <Button variant="ghost" className="min-h-12 col-span-2" disabled={busy === o.id} onClick={() => step(o, "assigned")}>Je la prends</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && <p className="mt-6 text-center text-sm text-muted-foreground">{done.length} livrée(s) aujourd'hui</p>}
    </>
  );
}
