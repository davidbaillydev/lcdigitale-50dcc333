import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="font-display text-3xl">LC Digitale</Link>
        <ThemeToggle />
      </header>
      <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-4xl">{forgot ? "Mot de passe oublié" : "Connexion"}</h1>
        <p className="text-sm text-muted-foreground">Agence ou restaurateur : un seul accès, vous arrivez automatiquement sur votre espace. Les comptes restaurateurs sont créés sur invitation.</p>
        <div><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {!forgot && <div><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
        <Button className="w-full" disabled={busy}>{forgot ? "Recevoir le lien" : "Se connecter"}</Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setForgot(!forgot)}>
          {forgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
        </button>
      </form>
    </div>
  );
}
