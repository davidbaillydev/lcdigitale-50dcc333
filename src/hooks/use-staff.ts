import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useStaff() {
  const [state, setState] = useState<{ loading: boolean; user: User | null; roles: string[] }>({ loading: true, user: null, roles: [] });
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return setState({ loading: false, user: null, roles: [] });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setState({ loading: false, user, roles: (roles ?? []).map((r) => r.role) });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(load, 0); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { ...state, isStaff: state.roles.length > 0, isAdmin: state.roles.includes("admin") };
}
