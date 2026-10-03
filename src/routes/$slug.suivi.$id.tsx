import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChefHat, PackageCheck, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getOrderStatus } from "@/lib/orders.functions";
import { euro } from "@/lib/menu";
import { fmtTime } from "@/lib/shop";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$slug/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de commande" },
      { name: "description", content: "Suivez l'avancement de votre commande en temps réel." },
      { property: "og:title", content: "Suivi de commande" },
      { property: "og:description", content: "Suivez votre commande." },
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
  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => fn({ data: { id } }), refetchInterval: 15000 });

  if (isLoading) return <div className="min-h-screen"><SiteHeader /><p className="p-10 text-center text-muted-foreground">Chargement…</p></div>;
  if (!data) return <div className="min-h-screen"><SiteHeader /><p className="p-10 text-center">Commande introuvable.</p></div>;

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
          {" · "}paiement {data.payment_method === "on_site" ? (data.mode === "delivery" ? "à la livraison" : "au retrait") : "en ligne"}
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
          <li className="flex justify-between py-3 font-bold"><span>Total</span><span className="text-primary">{euro(Number(data.total))}</span></li>
        </ul>
        <Button asChild variant="secondary" className="mt-6"><Link to="/$slug" params={{ slug }}>Retour à la carte</Link></Button>
      </div>
    </div>
  );
}
