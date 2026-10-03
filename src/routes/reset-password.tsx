import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choisir un mot de passe — LC Digitale" },
      { name: "description", content: "Définissez le mot de passe de votre compte LC Digitale." },
      { property: "og:title", content: "Choisir un mot de passe — LC Digitale" },
      { property: "og:description", content: "Activation ou réinitialisation de compte." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return toast.error("Les deux mots de passe sont différents");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message.includes("session") ? "Lien expiré : redemandez un email." : error.message);
    toast.success("Mot de passe enregistré");
    navigate({ to: "/espace" });
  };
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="font-display text-3xl">LC Digitale</Link><ThemeToggle />
      </header>
      <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-4xl">Choisir un mot de passe</h1>
        <div><Label htmlFor="p1">Nouveau mot de passe</Label><Input id="p1" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label htmlFor="p2">Confirmer</Label><Input id="p2" type="password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>Enregistrer</Button>
      </form>
    </div>
  );
}
