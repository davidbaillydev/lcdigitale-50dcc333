import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Espace restaurant — Wok & Sushi" },
      { name: "description", content: "Connexion de l'équipe Wok & Sushi à l'écran cuisine." },
      { property: "og:title", content: "Espace restaurant — Wok & Sushi" },
      { property: "og:description", content: "Connexion équipe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error("Identifiants incorrects");
        return;
      }
      navigate({ to: "/cuisine" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/cuisine` } });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Compte créé. Confirmez votre email, puis demandez au gérant d'activer votre accès.");
      setMode("in");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3">
        <Link to="/" className="font-display text-3xl">Nos restaurants</Link>
      </header>
      <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-4xl">{mode === "in" ? "Espace restaurant" : "Créer un compte équipe"}</h1>
        <div><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer le compte"}</Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Nouveau membre de l'équipe ? Créer un compte" : "J'ai déjà un compte"}
        </button>
      </form>
    </div>
  );
}
