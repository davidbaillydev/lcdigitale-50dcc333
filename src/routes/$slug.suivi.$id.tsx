import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChefHat, PackageCheck, Clock, Printer } from "lucide-react";
import { printTickets, type TicketOrder } from "@/lib/ticket";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderStatus } from "@/lib/orders.functions";
import { confirmOnlinePayment } from "@/lib/payments.functions";
import { useCart } from "@/lib/cart";
import { useEffect, useRef } from "react";
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
          {data.mode === "delivery" ? "Livraison" : "Retrait"} prévu à <strong className="text-foreground">{fmtTime(data.slot)}</strong>
          {" · "}{data.payment_method === "on_site" ? `paiement ${data.mode === "delivery" ? "à la livraison" : "au retrait"}` : data.payment_status === "paid" ? "payé en ligne ✓" : "paiement en ligne"}
        </p>
        {data.status === "cancelled" ? (
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
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card px-4">
          {items.map((it, i) => (
            <li key={i} className="py-3">
              <div className="flex justify-between"><span className="font-semibold">{it.qty}× {it.name}</span><span>{euro(it.total)}</span></div>
              {it.details.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
            </li>
          ))}
          {Number(data.discount) > 0 && <li className="flex justify-between py-3 text-primary"><span>Remise{data.promo_code ? ` ${data.promo_code}` : ""}</span><span>-{euro(Number(data.discount))}</span></li>}
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
