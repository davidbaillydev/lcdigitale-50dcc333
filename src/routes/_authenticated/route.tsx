import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceCountryFlag } from "@/components/WorkspaceCountryFlag";
import { ProfessionalAlerts } from "@/components/ProfessionalAlerts";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Session locale d'abord : évite de renvoyer à la connexion sur une simple
    // coupure réseau ou un rafraîchissement de jeton en cours.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) return { user: sessionData.session.user };
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
    // Erreur réseau transitoire : ne pas déconnecter, laisser la page retenter.
    if (error && error.name !== "AuthSessionMissingError" && error.status == null) {
      throw new Error("Vérification de session impossible, réessayez.");
    }
    throw redirect({ to: "/connexion" });
  },
  component: AdministrationLayout,
});

function AdministrationLayout() {
  const isRestaurant = useRouterState({ select: (state) => state.location.pathname.startsWith("/espace") });
  return (
    <div className={`admin-workspace min-h-screen bg-background text-foreground${isRestaurant ? " restaurant-workspace" : ""}`}>
      <div className="admin-masthead border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><Link to="/" className="workspace-wordmark font-display text-xl font-bold text-primary">LC Digitale<span aria-hidden="true">.</span></Link>{isRestaurant && <WorkspaceCountryFlag />}</div>
          <div className="flex items-center gap-2"><span className="hidden text-sm text-muted-foreground sm:inline">{isRestaurant ? "Espace restaurateur" : "Administration"}</span><ProfessionalAlerts /></div>
        </div>
      </div>
      <div className="admin-content"><Outlet /></div>
    </div>
  );
}
