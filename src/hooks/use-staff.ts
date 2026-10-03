import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type StaffRestaurant = { id: string; slug: string; name: string; city: string | null; logo_url: string | null; brand: { primary?: string; accent?: string }; address?: string | null; phone?: string | null; config?: Record<string, unknown> | null; role: "agency" | "manager" | "kitchen" };

/** Utilisateur connecté + restaurants auxquels il a accès (l'agence voit tous les restaurants) */
export function useStaff() {
  const [state, setState] = useState<{ loading: boolean; user: User | null; isAgency: boolean; restaurants: StaffRestaurant[] }>({
    loading: true, user: null, isAgency: false, restaurants: [],
  });
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return setState({ loading: false, user: null, isAgency: false, restaurants: [] });
      const [{ data: roles }, { data: members }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("restaurant_members").select("restaurant_id, role").eq("user_id", user.id),
      ]);
      const isAgency = (roles ?? []).some((r) => r.role === "admin");
      const ids = (members ?? []).map((m) => m.restaurant_id);
      let q = supabase.from("restaurants").select("id, slug, name, city, address, phone, logo_url, brand, config").order("name");
      if (!isAgency) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data: rs } = await q;
      const restaurants = (rs ?? []).map((r) => {
        const mine = (members ?? []).filter((m) => m.restaurant_id === r.id).map((m) => m.role);
        const role: StaffRestaurant["role"] = isAgency ? "agency" : mine.includes("manager") ? "manager" : "kitchen";
        return { ...r, brand: (r.brand ?? {}) as StaffRestaurant["brand"], config: r.config as Record<string, unknown> | null, role };
      });
      setState({ loading: false, user, isAgency, restaurants });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") setTimeout(load, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
