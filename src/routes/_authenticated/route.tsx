import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/connexion" });
    return { user: data.user };
  },
  component: AdministrationLayout,
});

function AdministrationLayout() {
  const isRestaurant = useRouterState({ select: (state) => state.location.pathname.startsWith("/espace") });
  return (
    <div className={`admin-workspace min-h-screen bg-background text-foreground${isRestaurant ? " restaurant-workspace" : ""}`}>
      <div className="admin-masthead border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="workspace-wordmark font-display text-xl font-bold text-primary">LC Digitale<span aria-hidden="true">.</span></Link>
          <span className="text-sm text-muted-foreground">{isRestaurant ? "Espace restaurateur" : "Administration"}</span>
        </div>
      </div>
      <div className="admin-content"><Outlet /></div>
    </div>
  );
}
