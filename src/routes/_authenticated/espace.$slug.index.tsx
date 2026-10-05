import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, BellOff, Bike, Check, ChefHat, Lock, LogOut, Phone, Printer, ShoppingBag, Users } from "lucide-react";
import { printTickets, printingDefaults, type PrintingConfig, type TicketKind } from "@/lib/ticket";
import { hasKitchenPin } from "@/lib/kitchen-pin.functions";
import { KitchenLock } from "@/components/KitchenLock";
import { PrinterSetup } from "@/components/PrinterSetup";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { allergenLabel } from "@/lib/allergens";
import { euro } from "@/lib/menu";
import { fmtTime } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/lib/brand";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/espace/$slug/")({
  head: () => ({
    meta: [
      { title: "Écran cuisine — LC Digitale" },
      { name: "description", content: "Tableau de bord des commandes en temps réel." },
      { property: "og:title", content: "Écran cuisine — LC Digitale" },
      { property: "og:description", content: "Commandes en temps réel." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Kitchen,
});

type Order = {
  id: string; order_number: number; customer_name: string; phone: string; mode: string; address: string | null; city: string | null;
  slot: string; items: { name: string; qty: number; details: string[]; allergens?: string[] }[]; notes: string | null; total: number;
  payment_method: string; payment_status?: string; status: string; source?: string; created_at: string;
};

type PrintLog = { id: string; kinds: string; status: string; reprint: boolean; auto: boolean; created_at: string };
const kindLabel = (k: string) => k.split(",").map((x) => (x === "kitchen" ? "cuisine" : "caisse")).join(" + ");

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
  const printing = printingDefaults((restaurant?.config as { printing?: Partial<PrintingConfig> } | null)?.printing);
  const [printState, setPrintState] = useState<Record<string, "ok" | "failed">>({});
  const [logs, setLogs] = useState<Record<string, PrintLog[]>>({});
  const [openLog, setOpenLog] = useState<string | null>(null);
  const doPrint = useCallback(async (o: Order, kinds: TicketKind[], auto = false) => {
    const shop = { name: restaurant?.name ?? "", address: restaurant?.address ?? null, phone: restaurant?.phone ?? null };
    const ok = await printTickets(o, kinds, shop, printing.width, printing.kitchen);
    setPrintState((p) => ({ ...p, [o.id]: ok ? "ok" : "failed" }));
    if (rid) {
      const reprint = (logs[o.id] ?? []).length > 0;
      const { data: row } = await supabase.from("order_print_logs")
        .insert({ order_id: o.id, restaurant_id: rid, kinds: kinds.join(","), status: ok ? "ok" : "failed", reprint, auto })
        .select("id, kinds, status, reprint, auto, created_at").single();
      if (row) setLogs((p) => ({ ...p, [o.id]: [...(p[o.id] ?? []), row as PrintLog] }));
    }
    if (!ok) toast.error(`Impression du ticket n° ${o.order_number} échouée`);
  }, [restaurant, rid, logs, printing.width, printing.kitchen]);
  const printRef = useRef({ auto: false, doPrint }); printRef.current = { auto: printing.auto, doPrint };
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const checkPin = useServerFn(hasKitchenPin);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const setLock = useCallback((v: boolean) => {
    setLocked(v);
    if (rid) { if (v) sessionStorage.setItem(`kitchen-lock-${rid}`, "1"); else sessionStorage.removeItem(`kitchen-lock-${rid}`); }
  }, [rid]);
  useEffect(() => {
    if (!rid) return;
    checkPin({ data: { restaurantId: rid } }).then((r) => {
      setPinEnabled(r.enabled);
      if (r.enabled && sessionStorage.getItem(`kitchen-lock-${rid}`)) setLocked(true);
    }).catch(() => {});
  }, [rid, checkPin]);
  // Verrouillage automatique après 5 minutes sans interaction
  useEffect(() => {
    if (!pinEnabled || locked) return;
    let t = setTimeout(() => setLock(true), 5 * 60_000);
    const reset = () => { clearTimeout(t); t = setTimeout(() => setLock(true), 5 * 60_000); };
    const evs = ["pointerdown", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, reset));
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [pinEnabled, locked, setLock]);


  useEffect(() => { if (!loading && !user) navigate({ to: "/connexion" }); }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("orders").select("*").eq("restaurant_id", rid ?? "").gte("created_at", since.toISOString()).order("slot");
    const list = ((data ?? []) as unknown as Order[]).filter((o) => o.status !== "awaiting_payment");
    setOrders(list);
    const ids = (data ?? []).map((o) => o.id);
    if (ids.length) {
      const { data: l } = await supabase.from("order_print_logs").select("id, order_id, kinds, status, reprint, auto, created_at").in("order_id", ids).order("created_at");
      const m: Record<string, PrintLog[]> = {};
      (l ?? []).forEach((x) => { (m[x.order_id] ??= []).push(x as PrintLog); });
      setLogs(m);
    }
  }, [rid]);

  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;
  useEffect(() => {
    if (!isStaff || !rid) return;
    load();
    const ch = supabase
      .channel(`orders-kitchen-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, (p) => {
        const n = p.new as Order;
        const becamePaid = p.eventType === "UPDATE" && n.status !== "awaiting_payment" && n.payment_method === "online" && n.payment_status === "paid" && !ordersRef.current.some((x) => x.id === n.id);
        if ((p.eventType === "INSERT" && n.status !== "awaiting_payment") || becamePaid) {
          toast.success(`Nouvelle commande n° ${(p.new as Order).order_number}`);
          if (audio.current) beep(audio.current);
          if (printRef.current.auto) void printRef.current.doPrint(p.new as Order, ["kitchen", "receipt"], true);
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
        <Button asChild className="mt-6 mr-2"><Link to="/espace">Mes restaurants</Link></Button>
        <Button className="mt-6" variant="secondary" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
      </div>
    );

  const done = orders.filter((o) => o.status === "done");
  return (
    <div className="admin-kitchen flex min-h-screen flex-col">
      <header className="kds-header border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
        {restaurants.length > 1 && <Button asChild variant="ghost" size="icon" aria-label="Mes restaurants"><Link to="/espace"><ArrowLeft /></Link></Button>}
        <BrandLogo src={restaurant?.logo_url} name={restaurant?.name ?? ""} />
        <div className="mr-auto min-w-0"><p className="text-sm text-muted-foreground">Écran cuisine</p><h1>{restaurant?.name}</h1></div>
        <Button variant={sound ? "secondary" : "default"} onClick={sound ? () => setSound(false) : enableSound} aria-pressed={sound} className="min-h-12">
          {sound ? <Bell /> : <BellOff />} {sound ? "Son activé" : "Activer le son"}
        </Button>
        {pinEnabled && <Button variant="secondary" onClick={() => setLock(true)}><Lock /> Verrouiller</Button>}
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
        </div>
        <nav aria-label="Gestion du restaurant" className="kds-navigation mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {isAdmin && <Button asChild variant="secondary"><Link to="/espace/$slug/carte" params={{ slug }}>Carte</Link></Button>}
        {isAdmin && <Button asChild variant="secondary"><Link to="/espace/$slug/reglages" params={{ slug }}>Réglages</Link></Button>}
        {restaurant?.role === "agency" && <Button asChild variant="secondary"><Link to="/espace/$slug/equipe" params={{ slug }}><Users /> Équipe</Link></Button>}
        {isAdmin && <Button asChild variant="secondary"><Link to="/espace/$slug/clients" params={{ slug }}>Clients</Link></Button>}
        {isAdmin && <Button asChild variant="secondary"><Link to="/espace/tableau-de-bord">Tableau de bord</Link></Button>}
        <PrinterSetup compact width={printing.width} shop={{ name: restaurant?.name ?? "", address: restaurant?.address ?? null, phone: restaurant?.phone ?? null }} />
        <span className="flex items-center gap-1 text-sm text-muted-foreground"><Printer className="h-4 w-4" />{printing.width} mm · {printing.auto ? "auto" : "manuel"}</span>
        </nav>
      </header>
      <div className="kds-service flex flex-wrap items-center justify-between gap-4 bg-primary px-6 py-5 text-primary-foreground">
        <p className="flex items-center gap-3 font-display text-2xl font-semibold"><ChefHat aria-hidden="true" /> Le service<span aria-hidden="true">.</span></p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><span><strong className="text-xl tabular-nums">{orders.filter((o) => COLS.some((c) => c.s === o.status)).length}</strong> en cours</span><span><strong className="text-xl tabular-nums">{done.length}</strong> terminée(s)</span><span>CA <strong className="text-xl tabular-nums">{euro(done.reduce((s, o) => s + Number(o.total), 0))}</strong></span></div>
      </div>
      <div className="kds-board grid flex-1 gap-5 p-4 lg:grid-cols-3 lg:p-6">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.s);
          return (
            <section key={c.s} data-kds-status={c.s} className="flex min-w-0 flex-col">
              <h2 className="kds-column-heading mb-4 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">{c.s === "new" ? <ShoppingBag aria-hidden="true" className="h-5 w-5" /> : c.s === "accepted" ? <ChefHat aria-hidden="true" className="h-5 w-5" /> : <Check aria-hidden="true" className="h-5 w-5" />}{c.label}</span><span className={cn("flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-lg tabular-nums", c.s === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.map((o) => (
                   <article key={o.id} className={cn("kds-ticket rounded-lg border bg-card p-4", c.s === "new" ? "border-primary" : "border-border")}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0 break-words">
                        <p className="font-display text-3xl leading-none">n° {o.order_number}</p>
                        <p className="text-sm">{o.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="flex items-center justify-end gap-1 font-display text-3xl leading-none text-primary">
                          {o.mode === "delivery" ? <Bike className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}{fmtTime(o.slot)}
                        </p>
                        <p className="text-xs text-muted-foreground">{o.source === "kiosk" ? "BORNE · " : o.source === "phone" ? "TÉLÉPHONE IA · " : ""}{o.mode === "delivery" ? "Livraison" : o.mode === "dine_in" ? "Sur place" : "À emporter"}</p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          <p className="text-lg font-semibold"><span className="text-primary">{it.qty}×</span> {it.name}</p>
                          {it.details.map((d) => <p key={d} className="pl-5 text-sm text-muted-foreground">{d}</p>)}
                          {!!it.allergens?.length && <p className="pl-5 text-sm font-semibold text-destructive">⚠ {it.allergens.map(allergenLabel).join(", ")}</p>}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-2 rounded border-l-4 border-primary bg-accent p-3 text-sm font-medium">⚠ {o.notes}</p>}
                    {o.mode === "delivery" && <p className="mt-2 text-sm">{o.address}, {o.city}</p>}
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 break-words text-sm text-muted-foreground">
                      {o.source === "kiosk" ? <span /> : <a href={`tel:${o.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.phone}</a>}
                      <span>{euro(Number(o.total))} · {o.payment_method === "online" && o.payment_status === "paid" ? `Payé en ligne (${String((o as { payment_ref?: string | null }).payment_ref ?? "").startsWith("paypal:") ? "PayPal" : String((o as { payment_ref?: string | null }).payment_ref ?? "").startsWith("lyra:") ? "Lyra" : "Stripe"})` : o.payment_status === "paid" ? "payé (terminal)" : o.payment_method === "online" ? "payé" : o.payment_method === "card_terminal" ? "CB au comptoir" : o.payment_method === "counter" ? "espèces/TR au comptoir" : "à encaisser"}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="lg" className="min-h-14 flex-1 text-base font-semibold" onClick={() => move(o, c.next)}>{c.action}<ArrowRight aria-hidden="true" /></Button>
                      {c.s === "new" && <Button size="lg" variant="outline" className="min-h-14" onClick={() => confirm("Refuser cette commande ?") && move(o, "cancelled")}>Refuser</Button>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" className="min-h-12 min-w-0 flex-1" onClick={() => doPrint(o, ["kitchen"])}><Printer /> {logs[o.id]?.length ? "Réimprimer cuisine" : "Cuisine"}</Button>
                      <Button size="sm" variant="secondary" className="min-h-12 min-w-0 flex-1" onClick={() => doPrint(o, ["receipt"])}><Printer /> Caisse</Button>
                    </div>
                    {(printState[o.id] ?? logs[o.id]?.at(-1)?.status) === "failed" && <p role="alert" className="mt-2 rounded bg-destructive/20 p-2 text-sm">Impression échouée — vérifiez l'imprimante puis réimprimez.</p>}
                    {!!logs[o.id]?.length && (
                      <div className="mt-1">
                        <Button type="button" variant="ghost" size="sm" className="h-auto min-h-11 w-full justify-start px-0 text-xs text-muted-foreground underline" aria-expanded={openLog === o.id} onClick={() => setOpenLog(openLog === o.id ? null : o.id)}>
                          Historique d'impression ({logs[o.id]?.length ?? 0})
                        </Button>
                        {openLog === o.id && (
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {(logs[o.id] ?? []).map((l) => (
                              <li key={l.id} className="flex justify-between gap-2">
                                <span>{new Date(l.created_at).toLocaleTimeString("fr-FR")} · {l.reprint ? "Réimpression" : "Impression"} {kindLabel(l.kinds)}{l.auto ? " (auto)" : ""}</span>
                                <span className={l.status === "ok" ? "text-primary" : "text-destructive"}>{l.status === "ok" ? "Envoyé" : "Échec"}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {!list.length && <div className="kds-empty flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground"><span className="font-display text-5xl font-semibold tabular-nums" aria-hidden="true">00</span><p className="text-sm">Aucune commande</p></div>}
              </div>
            </section>
          );
        })}
      </div>
      {locked && rid && <KitchenLock restaurantId={rid} name={restaurant?.name ?? ""} onUnlock={() => setLock(false)} />}
    </div>
  );
}
