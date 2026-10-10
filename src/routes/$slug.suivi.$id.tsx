import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChefHat, PackageCheck, Clock, Printer } from "lucide-react";
import { printTickets, type TicketOrder } from "@/lib/ticket";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderStatus } from "@/lib/orders.functions";
import { getCustomerInvoice } from "@/lib/invoice.functions";
import { getCustomerCreditNotes } from "@/lib/refunds.functions";
import { subscribeOrderPush } from "@/lib/push.functions";
import { getPushEndpoint, needsInstallForPush, pushSupported } from "@/lib/push";
import { toast } from "sonner";
import { confirmOnlinePayment } from "@/lib/payments.functions";
import { useCart } from "@/lib/cart";
import { postToParent } from "@/lib/embed";
import { useEffect, useRef, useState } from "react";
import { euro } from "@/lib/menu";
import { fmtTime } from "@/lib/shop";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$slug/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de commande — LC Digitale" },
      { name: "description", content: "Suivez l'avancement de votre commande en temps réel." },
      { property: "og:title", content: "Suivi de commande — LC Digitale" },
      { property: "og:description", content: "Suivez votre commande." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Tracking,
});

const STEPS = [
  { s: "new", label: "Reçue", Icon: Clock },
  { s: "accepted", label: "En préparation", Icon: ChefHat },
  { s: "ready", label: "Prête", Icon: PackageCheck },
  { s: "done", label: "Terminée", Icon: CheckCircle2 },
];

function Tracking() {
  const { id, slug } = Route.useParams();
  const fn = useServerFn(getOrderStatus);
  const confirm = useServerFn(confirmOnlinePayment);
  const { clear } = useCart();
  const cleared = useRef(false);
  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const o = await fn({ data: { id } });
      if (o?.status === "awaiting_payment") {
        // Retour de PayPal (?annule=1) ou de Lyra (paramètres vads_* signés, revérifiés côté serveur)
        const qs = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
        const lyra: Record<string, string> = {};
        qs.forEach((v, k) => { if (k.startsWith("vads_") || k === "signature") lyra[k] = v; });
        const r = await confirm({ data: { orderId: id, cancelled: qs.get("annule") === "1", ...(lyra["signature"] ? { lyra } : {}) } }).catch(() => null);
        if (r?.status === "paid") return fn({ data: { id } });
        return { ...o, _pay: r?.status ?? "pending" };
      }
      return o;
    },
    refetchInterval: (q) => (q.state.data?.status === "awaiting_payment" ? 3000 : 15000),
  });
  useEffect(() => {
    if (!cleared.current && data && data.payment_method === "online" && data.payment_status === "paid") { cleared.current = true; clear(); }
  }, [data, clear]);
  // Mode intégré : signale au site parent que la commande est confirmée (une seule fois par commande)
  useEffect(() => {
    if (!data || data.status === "awaiting_payment" || data.status === "cancelled") return;
    const confirmed = data.payment_method === "on_site" || data.payment_status === "paid";
    if (!confirmed) return;
    const key = `lc-order-sent-${data.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* stockage indisponible */ }
    postToParent({ type: "lc:order-completed", orderNumber: data.order_number, total: Number(data.total) });
  }, [data]);

  if (isLoading) return <div className="min-h-screen"><SiteHeader /><p className="p-10 text-center text-muted-foreground">Chargement…</p></div>;
  if (!data) return <div className="min-h-screen"><SiteHeader /><p className="p-10 text-center">Commande introuvable.</p></div>;

  if (data.status === "awaiting_payment") {
    const pay = (data as { _pay?: string })._pay;
    return (
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-4xl">Commande n° {data.order_number}</h1>
          {pay === "retry" || pay === "failed" ? (
            <>
              <p role="alert" className="mt-4 rounded-lg bg-destructive/20 p-4">Le paiement n'a pas abouti. Votre commande n'a pas été envoyée au restaurant.</p>
              <Button asChild className="mt-4"><Link to="/$slug/commande" params={{ slug }}>Revenir à ma commande</Link></Button>
            </>
          ) : <p className="mt-4 text-muted-foreground">Vérification du paiement en cours…</p>}
        </div>
      </div>
    );
  }

  const idx = STEPS.findIndex((x) => x.s === data.status);
  const items = data.items as { name: string; qty: number; total: number; details: string[] }[];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="inline-block -rotate-1 brush px-4 py-1 font-display text-xl">Merci {data.customer_name} !</p>
        <h1 className="mt-3 text-5xl">Commande n° {data.order_number}</h1>
        <p className="text-muted-foreground">
          {data.mode === "dine_in" ? <>Sur place{data.table_label ? <> · <strong className="text-foreground">Table {data.table_label}</strong></> : null}</> : <>{data.mode === "delivery" ? "Livraison" : "Retrait"} prévu à <strong className="text-foreground">{fmtTime(data.slot)}</strong></>}
          {" · "}{data.payment_method === "on_site" ? `paiement ${data.mode === "delivery" ? "à la livraison" : data.mode === "dine_in" ? "à table ou au comptoir" : "au retrait"}` : data.payment_status === "paid" ? "payé en ligne ✓" : "paiement en ligne"}
        </p>
        {data.status === "pending_approval" ? (
          <p role="status" className="mt-6 animate-pulse rounded-lg border border-primary bg-primary/10 p-4 font-semibold">Commande transmise à l'équipe, en attente de confirmation.</p>
        ) : data.status === "cancelled" ? (
          <p className="mt-6 rounded-lg bg-destructive/20 p-4">Cette commande a été annulée. Contactez le restaurant pour plus d'informations.</p>
        ) : (
          <div className="mt-8 grid grid-cols-4 gap-2">
            {STEPS.map(({ s, label, Icon }, i) => (
              <div key={s} className="text-center">
                <div className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full", i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className={cn("mt-2 text-xs", i <= idx ? "text-foreground" : "text-muted-foreground")}>{label}</p>
              </div>
            ))}
          </div>
        )}
        {!["done", "cancelled"].includes(data.status) && <PushOptIn orderId={data.id} />}
        {["accepted", "preparing", "ready", "delivering", "done"].includes(data.status) && <InvoiceDownload orderId={data.id} />}
        {data.review_url && (data.status === "ready" || data.status === "done") && (
          <div className="mt-8 rounded-xl border border-primary bg-primary/10 p-4 text-center">
            <p className="font-semibold">Vous avez aimé ? Votre avis nous aide énormément ★★★★★</p>
            <Button asChild className="mt-3"><a href={data.review_url} target="_blank" rel="noopener noreferrer">Laisser un avis Google</a></Button>
          </div>
        )}
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card px-4">
          {items.map((it, i) => (
            <li key={i} className="py-3">
              <div className="flex justify-between"><span className="font-semibold">{it.qty}× {it.name}</span><span>{euro(it.total)}</span></div>
              {it.details.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
            </li>
          ))}
          {Number(data.discount) > 0 && <li className="flex justify-between py-3 text-primary"><span>Remise{data.promo_code ? ` ${data.promo_code}` : ""}</span><span>-{euro(Number(data.discount))}</span></li>}
          {Number((data as { service_fee?: number }).service_fee) > 0 && <li className="flex justify-between py-3"><span>Frais de service</span><span>{euro(Number((data as { service_fee?: number }).service_fee))}</span></li>}
          {Number(data.delivery_fee) > 0 && <li className="flex justify-between py-3"><span>Livraison</span><span>{euro(Number(data.delivery_fee))}</span></li>}
          <li className="flex justify-between py-3 font-bold"><span>Total</span><span className="text-primary">{euro(Number(data.total))}</span></li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link to="/$slug" params={{ slug }}>Retour à la carte</Link></Button>
          <Button variant="outline" onClick={() => printTickets(data as unknown as TicketOrder, ["receipt"], "")}><Printer /> Imprimer le ticket</Button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDownload({ orderId }: { orderId: string }) {
  const get = useServerFn(getCustomerInvoice);
  const run = async () => {
    try { const inv = await get({ data: { orderId } }); const { downloadInvoice } = await import("@/lib/invoice"); await downloadInvoice(inv); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Facture indisponible"); }
  };
  const done = useRef(false);
  useEffect(() => {
    if (done.current || new URLSearchParams(window.location.search).get("facture") !== "1") return;
    done.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    run();
  }, []);
  const getNotes = useServerFn(getCustomerCreditNotes);
  const { data: notes } = useQuery({ queryKey: ["credit-notes", orderId], queryFn: () => getNotes({ data: { orderId } }) });
  return (
    <>
      <Button variant="secondary" className="mt-4 min-h-12 w-full" onClick={run}>Télécharger ma facture (PDF / Factur-X)</Button>
      {(notes ?? []).map((n) => (
        <Button key={n.number} variant="outline" className="mt-2 min-h-12 w-full" onClick={async () => { const { downloadInvoice } = await import("@/lib/invoice"); await downloadInvoice(n); }}>
          Télécharger l'avoir {n.number} ({(n.data.totalTTC).toFixed(2).replace(".", ",")} € remboursés)
        </Button>
      ))}
    </>
  );
}

function PushOptIn({ orderId }: { orderId: string }) {
  const sub = useServerFn(subscribeOrderPush);
  const [state, setState] = useState<"idle" | "busy" | "on" | "off">("idle");
  useEffect(() => { if (!pushSupported()) setState("off"); else if (Notification.permission === "granted" && localStorage.getItem(`push-${orderId}`)) setState("on"); }, [orderId]);
  if (state === "off") return needsInstallForPush() ? <p className="mt-4 text-sm text-muted-foreground">Pour être prévenu sur iPhone, ajoutez ce site à l'écran d'accueil (Partager → « Sur l'écran d'accueil »).</p> : null;
  if (state === "on") return <p className="mt-4 text-sm text-muted-foreground">Notifications activées : vous serez prévenu à chaque étape.</p>;
  return (
    <Button variant="secondary" className="mt-4 min-h-12 w-full" disabled={state === "busy"} onClick={async () => {
      setState("busy");
      try {
        const ep = await getPushEndpoint();
        if (!ep) { toast.error("Notifications refusées par l'appareil."); setState("idle"); return; }
        await sub({ data: { orderId, endpoint: ep } });
        localStorage.setItem(`push-${orderId}`, "1"); setState("on"); toast.success("Notifications activées");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Activation impossible"); setState("idle"); }
    }}>Me prévenir quand ma commande avance</Button>
  );
}
