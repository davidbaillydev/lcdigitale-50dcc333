import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Driver = { id: string; name: string; active: boolean };

/** Livreurs actifs du restaurant, synchronisés en direct. */
export function useDrivers(restaurantId: string | undefined) {
  const [list, setList] = useState<Driver[]>([]);
  useEffect(() => {
    if (!restaurantId) return;
    const load = async () => {
      const { data } = await supabase.from("restaurant_drivers").select("id, name, active").eq("restaurant_id", restaurantId).order("name");
      setList((data ?? []) as Driver[]);
    };
    load();
    const ch = supabase.channel(`drivers-${restaurantId}-${Math.random().toString(36).slice(2, 7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_drivers", filter: `restaurant_id=eq.${restaurantId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);
  return list;
}

/** Sélecteur « Assigner un livreur » sur une commande en livraison. */
export function DriverSelect({ orderId, driverId, drivers, courierStatus }: { orderId: string; driverId: string | null; drivers: Driver[]; courierStatus?: string | null }) {
  const [busy, setBusy] = useState(false);
  const change = async (v: string) => {
    setBusy(true);
    const { error } = await supabase.from("orders").update({
      driver_id: v || null,
      courier_status: v ? (courierStatus === "en_route" ? "en_route" : "assigned") : null,
      courier_name: v ? drivers.find((d) => d.id === v)?.name ?? null : null,
    }).eq("id", orderId);
    setBusy(false);
    if (error) toast.error("Attribution impossible"); else toast.success(v ? "Livreur assigné" : "Livreur retiré");
  };
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Assigner un livreur</span>
      <select aria-label="Assigner un livreur" disabled={busy || courierStatus === "delivered"} value={driverId ?? ""} onChange={(e) => change(e.target.value)} className="min-h-11 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">Assigner un livreur…</option>
        {drivers.filter((d) => d.active || d.id === driverId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>
  );
}
