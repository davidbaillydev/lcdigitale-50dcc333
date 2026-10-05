import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
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
  return (
    <div className="admin-workspace min-h-screen bg-background text-foreground">
      <div className="admin-masthead border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="font-display text-xl font-bold text-primary">LC Digitale</Link>
          <span className="text-sm text-muted-foreground">Administration</span>
        </div>
      </div>
      <div className="admin-content"><Outlet /></div>
    </div>
  );
}
