import { Bike, MapPin } from "lucide-react";
import { formatDeliveryKm, kitchenDeliveryInfo, type KitchenDeliveryOrder } from "@/lib/kitchen-delivery";
import type { LatLng } from "@/lib/geo";

export function KitchenDeliveryInfo({ order, origin }: { order: KitchenDeliveryOrder; origin?: LatLng | null | undefined }) {
  const info = kitchenDeliveryInfo(order, origin);
  return (
    <section aria-label="Informations de livraison" className="mt-3 space-y-2 border-y-2 border-primary bg-primary/10 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-h-10 items-center gap-2 font-display text-lg font-bold text-primary"><Bike aria-hidden="true" className="h-8 w-8 shrink-0" />LIVRAISON</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">{info.km === null ? "Distance indisponible" : formatDeliveryKm(info.km)}</span>
      </div>
      <p className="flex items-start gap-2 text-base font-semibold"><MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 break-words">{info.address || "Adresse non renseignée"}</span></p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {info.km !== null && <span>À vol d’oiseau depuis le restaurant</span>}
        {info.zone && <span className="font-semibold text-foreground">Zone : {info.zone}</span>}
      </div>
    </section>
  );
}