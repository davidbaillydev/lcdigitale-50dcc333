import { FeatureGate } from "@/components/FeatureGate";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crumbs } from "@/components/Crumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";
import { supabase } from "@/integrations/supabase/client";
import { euro } from "@/lib/menu";
import { chargeNoShow, saveReservationSettings, reservationInfo } from "@/lib/reservations.functions";

export const Route = createFileRoute("/_authenticated/espace/$slug/reservations")({
  head: () => ({
    meta: [
      { title: "Réservations — LC Digitale" },
      { name: "description", content: "Réservations du restaurant et garantie anti no-show." },
      { property: "og:title", content: "Réservations" },
      { property: "og:description", content: "Réservations et no-show." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Gated,
});

const LABEL: Record<string, string> = { pending_card: "Carte en attente", confirmed: "Confirmée", seated: "Arrivé", no_show: "No-show", cancelled: "Annulée" };

function Page() {
  const { slug } = Route.useParams();
  const { restaurants } = useStaff();
  const r = restaurants.find((x) => x.slug === slug);
  const rid = r?.id;
  const qc = useQueryClient();
  const key = ["reservations", rid];
  const list = useQuery({
    queryKey: key, enabled: !!rid,
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("reservations").select("*").eq("restaurant_id", rid!).gte("starts_at", since).neq("status", "pending_card").order("starts_at");
      if (error) throw error;
      return data;
    },
  });
  // Realtime : la liste se met à jour dès qu'un client réserve
  useEffect(() => {
    if (!rid) return;
    const ch = supabase.channel(`reservations-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${rid}` }, () => qc.invalidateQueries({ queryKey: ["reservations", rid] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rid, qc]);

  const charge = useServerFn(chargeNoShow);
  const noShow = useMutation({
    mutationFn: (id: string) => charge({ data: { id } }),
    onSuccess: (d) => { toast.success(d.charged ? `${euro(d.charged)} débités` : "Marqué no-show"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex items-center justify-between"><Crumbs slug={slug} page="Réservations" /><ThemeToggle /></div>
      <h1 className="text-5xl">Réservations</h1>
      {rid && (r?.role === "manager" || r?.role === "agency") && <Settings slug={slug} restaurantId={rid} />}
      {list.isLoading || !rid ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
        <ul className="space-y-2">
          {!list.data?.length && <p className="text-muted-foreground">Aucune réservation à venir.</p>}
          {list.data?.map((x) => {
            const past = new Date(x.starts_at).getTime() < Date.now();
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{new Date(x.starts_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {x.party_size} pers.</p>
                  <p className="text-sm">{x.customer_name} · <a href={`tel:${x.phone}`} className="underline">{x.phone}</a></p>
                  {x.notes && <p className="text-xs text-muted-foreground">{x.notes}</p>}
                </div>
                <Badge variant={x.status === "no_show" ? "destructive" : "secondary"}>{LABEL[x.status] ?? x.status}{x.payment_method ? " · carte" : ""}{x.charged_amount ? ` · ${euro(Number(x.charged_amount))}` : ""}</Badge>
                {x.status === "confirmed" && <>
                  <Button size="sm" className="min-h-11" onClick={() => setStatus.mutate({ id: x.id, status: "seated" })}>Arrivé</Button>
                  <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setStatus.mutate({ id: x.id, status: "cancelled" })}>Annuler</Button>
                  {past && <Button size="sm" variant="destructive" className="min-h-11" disabled={noShow.isPending}
                    onClick={() => { if (confirm(x.payment_method && Number(x.no_show_fee) > 0 ? `Débiter ${euro(Number(x.no_show_fee))} sur la carte ?` : "Marquer no-show ?")) noShow.mutate(x.id); }}>No-show</Button>}
                </>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Settings({ slug, restaurantId }: { slug: string; restaurantId: string }) {
  const infoFn = useServerFn(reservationInfo);
  const saveFn = useServerFn(saveReservationSettings);
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["reservation-info", slug], queryFn: () => infoFn({ data: { slug } }) });
  const [s, setS] = useState<{ enabled: boolean; noShowFee: number; maxParty: number } | null>(null);
  useEffect(() => { if (info.data && !s) setS({ enabled: info.data.enabled, noShowFee: info.data.noShowFee, maxParty: info.data.maxParty }); }, [info.data, s]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { restaurantId, ...s! } }),
    onSuccess: () => { toast.success("Réglages enregistrés"); qc.invalidateQueries({ queryKey: ["reservation-info", slug] }); qc.invalidateQueries({ queryKey: ["restaurant", slug] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!s) return <Skeleton className="h-24" />;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <label className="flex min-h-11 items-center justify-between gap-3"><span className="font-semibold">Réservations en ligne</span><Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="fee">Frais no-show (€, 0 = sans carte)</Label><Input id="fee" type="number" min={0} max={200} value={s.noShowFee} onChange={(e) => setS({ ...s, noShowFee: Number(e.target.value) })} /></div>
        <div><Label htmlFor="mp">Couverts max en ligne</Label><Input id="mp" type="number" min={1} max={30} value={s.maxParty} onChange={(e) => setS({ ...s, maxParty: Number(e.target.value) })} /></div>
      </div>
      {s.noShowFee > 0 && info.data && !info.data.publishableKey && <p className="text-sm text-destructive">Stripe n'est pas actif : la garantie carte ne sera pas demandée (à activer par l'agence).</p>}
      <Button className="min-h-11" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
    </section>
  );
}

function Gated() {
  const { slug } = Route.useParams();
  return <FeatureGate slug={slug} feature="reservation"><Page /></FeatureGate>;
}
