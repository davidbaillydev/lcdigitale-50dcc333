import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — LC Digitale" },
      { name: "description", content: "Connexion à la console agence ou à l'espace restaurateur LC Digitale." },
      { property: "og:title", content: "Connexion — LC Digitale" },
      { property: "og:description", content: "Accès agence et restaurateurs." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Si ce compte existe, un email de réinitialisation vient d'être envoyé.");
      return setForgot(false);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setBusy(false); return toast.error("Identifiants incorrects"); }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    setBusy(false);
    navigate({ to: isAdmin ? "/admin" : "/espace" });
  };

  return (
    <div className="admin-workspace connexion-screen min-h-screen bg-background text-foreground">
      <header className="connexion-top border-b border-border">
        <div className="workspace-inner flex items-center justify-between gap-4 py-5">
          <Link to="/" className="font-display text-xl font-bold text-primary">LC Digitale<span aria-hidden="true">.</span></Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="connexion-poster bg-primary text-primary-foreground">
        <div className="workspace-inner py-12 sm:py-16">
          <p className="text-sm font-semibold">LC Digitale / Accès</p>
          <h1 className="connexion-title font-display">Espace de connexion<span aria-hidden="true">.</span></h1>
          <p className="border-t border-primary-foreground/30 pt-4 text-sm">Un seul accès : agence ou restaurateur, vous arrivez automatiquement sur votre espace.</p>
        </div>
      </div>
      <main className="workspace-inner connexion-main grid gap-x-12 pb-16 pt-10 lg:grid-cols-2">
        <div className="connexion-statement border-b border-border pb-10 lg:border-b-0 lg:pb-0">
          <h2 className="font-display text-2xl sm:text-3xl">Vos écrans, en clair et en sombre.</h2>
          <p className="mt-4 max-w-prose text-muted-foreground">
            Console agence pour l'ensemble des établissements partenaires, espace restaurateur pour vos commandes,
            votre carte et votre cuisine. Chacun voit uniquement ce qui lui appartient.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ["Agence", "Création des restaurants, branding, paiements, campagnes, invitations."],
              ["Gérant", "Commandes, carte et prix, horaires et livraison, rapports, clients, promos."],
              ["Cuisine", "Écran de service temps réel, transmission des plats et impression."],
            ].map(([role, desc]) => (
              <li key={role} className="flex gap-4 border-b border-border pb-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <p className="min-w-0 text-sm"><span className="font-display font-semibold text-primary">{role}</span><span className="block text-muted-foreground">{desc}</span></p>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={submit} className="connexion-form h-fit rounded-lg border border-border bg-card p-6 sm:p-8" aria-label={forgot ? "Mot de passe oublié" : "Connexion"}>
          <div className="mb-6 flex items-start justify-between gap-3">
            <h2 className="font-display text-3xl">{forgot ? "Mot de passe oublié" : "Connexion"}</h2>
            <ArrowUpRight aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
          </div>
          <p className="mb-6 text-sm text-muted-foreground">Les comptes restaurateurs sont créés sur invitation par l'agence ou le gérant.</p>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {!forgot && (
              <div className="space-y-2">
                <Label htmlFor="pw">Mot de passe</Label>
                <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
            )}
            <Button className="min-h-12 w-full" disabled={busy}>{forgot ? "Recevoir le lien" : "Se connecter"}</Button>
            <button type="button" className="min-h-12 w-full text-sm text-muted-foreground underline" onClick={() => setForgot(!forgot)}>
              {forgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
