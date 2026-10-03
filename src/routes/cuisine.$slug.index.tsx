import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, Bike, LogOut, Phone, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { euro } from "@/lib/menu";
import { fmtTime } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandTheme } from "@/lib/brand";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/cuisine/$slug/")({
  head: () => ({
    meta: [
      { title: "Écran cuisine" },
      { name: "description", content: "Tableau de bord des commandes en temps réel." },
      { property: "og:title", content: "Écran cuisine" },
      { property: "og:description", content: "Commandes en temps réel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Kitchen,
});

type Order = {
  id: string; order_number: number; customer_name: string; phone: string; mode: string; address: string | null; city: string | null;
  slot: string; items: { name: string; qty: number; details: string[] }[]; notes: string | null; total: number;
  payment_method: string; status: string; source?: string; created_at: string;
};

const COLS = [
  { s: "new", label: "Nouvelles", next: "accepted", action: "Accepter" },
  { s: "accepted", label: "En préparation", next: "ready", action: "Prête" },
  { s: "ready", label: "Prêtes", next: "done", action: "Terminée" },
] as const;

function beep(ctx: AudioContext) {
  [0, 0.25, 0.5].forEach((t, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880; o.type = "square";
    g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
  });
}

function Kitchen() {
  const { slug } = Route.useParams();
  const { loading, user, restaurants } = useStaff();
  const restaurant = restaurants.find((r) => r.slug === slug);
  const isStaff = !!restaurant;
  const isAdmin = restaurant?.role === "agency" || restaurant?.role === "manager";
  const rid = restaurant?.id;
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/connexion" }); }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("orders").select("*").eq("restaurant_id", rid ?? "").gte("created_at", since.toISOString()).order("slot");
    setOrders((data ?? []) as unknown as Order[]);
  }, [rid]);

  useEffect(() => {
    if (!isStaff || !rid) return;
    load();
    const ch = supabase
      .channel(`orders-kitchen-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, (p) => {
        if (p.eventType === "INSERT") {
          toast.success(`Nouvelle commande n° ${(p.new as Order).order_number}`);
          if (audio.current) beep(audio.current);
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isStaff, rid, load]);

  // Rappel sonore tant qu'il reste des commandes non acceptées
  const pending = orders.filter((o) => o.status === "new").length;
  useEffect(() => {
    if (!sound || !pending) return;
    const t = setInterval(() => audio.current && beep(audio.current), 20000);
    return () => clearInterval(t);
  }, [sound, pending]);

  const enableSound = () => {
    if (!audio.current) audio.current = new AudioContext();
    audio.current.resume(); beep(audio.current); setSound(true);
  };

  const move = async (o: Order, status: string) => {
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id);
    if (error) { toast.error("Mise à jour impossible"); load(); }
  };

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (user && !isStaff)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-4xl">Accès en attente</h1>
        <p className="mt-2 text-muted-foreground">Votre compte ({user.email}) n'a pas accès à ce restaurant.</p>
        <Button asChild className="mt-6 mr-2"><Link to="/cuisine">Mes restaurants</Link></Button>
        <Button className="mt-6" variant="secondary" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
      </div>
    );

  const done = orders.filter((o) => o.status === "done");
  return (
    <BrandTheme brand={restaurant?.brand}>
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        {restaurants.length > 1 && <Button asChild variant="ghost" size="icon" aria-label="Mes restaurants"><Link to="/cuisine"><ArrowLeft /></Link></Button>}
        <BrandLogo src={restaurant?.logo_url} name={restaurant?.name ?? ""} />
        <h1 className="mr-auto text-3xl">Cuisine <span className="text-primary">{restaurant?.name}</span></h1>
        <span className="text-sm text-muted-foreground">{done.length} terminée(s) · CA {euro(done.reduce((s, o) => s + Number(o.total), 0))}</span>
        <Button variant={sound ? "secondary" : "default"} onClick={sound ? () => setSound(false) : enableSound} className={cn(!sound && "animate-pulse")}>
          {sound ? <Bell /> : <BellOff />} {sound ? "Son activé" : "Activer le son"}
        </Button>
        {isAdmin && <Button asChild variant="secondary"><Link to="/cuisine/$slug/carte" params={{ slug }}>Carte</Link></Button>}
        {isAdmin && <Button asChild variant="secondary"><Link to="/cuisine/$slug/equipe" params={{ slug }}><Users /> Équipe</Link></Button>}
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
      </header>
      <div className="grid flex-1 gap-4 p-4 md:grid-cols-3">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.s);
          return (
            <section key={c.s} className="flex flex-col rounded-xl bg-card/50 p-3">
              <h2 className="mb-3 flex items-center justify-between text-2xl">
                {c.label}<span className={cn("rounded-full px-3 text-lg", c.s === "new" && list.length ? "bg-accent text-accent-foreground" : "bg-muted")}>{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.map((o) => (
                  <article key={o.id} className={cn("rounded-lg border bg-card p-4", c.s === "new" ? "border-accent" : "border-border")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-3xl leading-none">n° {o.order_number}</p>
                        <p className="text-sm">{o.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="flex items-center justify-end gap-1 font-display text-3xl leading-none text-primary">
                          {o.mode === "delivery" ? <Bike className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}{fmtTime(o.slot)}
                        </p>
                        <p className="text-xs text-muted-foreground">{o.source === "kiosk" ? "BORNE · " : ""}{o.mode === "delivery" ? "Livraison" : o.mode === "dine_in" ? "Sur place" : "À emporter"}</p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          <p className="font-semibold"><span className="text-primary">{it.qty}×</span> {it.name}</p>
                          {it.details.map((d) => <p key={d} className="pl-5 text-sm text-muted-foreground">{d}</p>)}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-2 rounded bg-accent/20 p-2 text-sm">⚠ {o.notes}</p>}
                    {o.mode === "delivery" && <p className="mt-2 text-sm">{o.address}, {o.city}</p>}
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      {o.source === "kiosk" ? <span /> : <a href={`tel:${o.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.phone}</a>}
                      <span>{euro(Number(o.total))} · {o.payment_method === "online" ? "payé" : o.payment_method === "card_terminal" ? "CB au comptoir" : o.payment_method === "counter" ? "espèces/TR au comptoir" : "à encaisser"}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="lg" className="flex-1 font-semibold" onClick={() => move(o, c.next)}>{c.action}</Button>
                      {c.s === "new" && <Button size="lg" variant="ghost" onClick={() => confirm("Refuser cette commande ?") && move(o, "cancelled")}>Refuser</Button>}
                    </div>
                  </article>
                ))}
                {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">Aucune commande</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
    </BrandTheme>
  );
}
