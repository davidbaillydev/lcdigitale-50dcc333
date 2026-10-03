import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Espace super-admin : réservé au rôle agence, vérifié avant tout affichage (et revérifié par chaque action serveur). */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/espace" });
  },
  component: () => <Outlet />,
});
