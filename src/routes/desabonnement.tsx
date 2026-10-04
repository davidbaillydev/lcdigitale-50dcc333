import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { unsubscribe } from "@/lib/campaign.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/desabonnement")({
  validateSearch: (s) => z.object({ c: z.string().optional(), t: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Se désabonner des offres — LC Digitale" },
      { name: "description", content: "Ne plus recevoir les emails promotionnels du restaurant." },
      { property: "og:title", content: "Se désabonner des offres" },
      { property: "og:description", content: "Gérer vos préférences d'emails promotionnels." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { c, t } = Route.useSearch();
  const run = useServerFn(unsubscribe);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-4xl">Désabonnement</h1>
      {!c || !t ? <p className="mt-4 text-muted-foreground">Ceci est un email de test : aucun désabonnement à effectuer.</p>
        : state === "done" ? <p className="mt-4">C'est fait : vous ne recevrez plus les offres{name ? ` de ${name}` : ""}.</p>
        : <>
          <p className="mt-4 text-muted-foreground">Vous ne recevrez plus les emails promotionnels de ce restaurant.</p>
          <Button className="mt-6" disabled={state === "busy"} onClick={async () => {
            setState("busy");
            try { const r = await run({ data: { c, t } }); setName(r.restaurant); setState("done"); } catch { setState("error"); }
          }}>Confirmer le désabonnement</Button>
          {state === "error" && <p className="mt-3 text-destructive">Lien invalide ou expiré.</p>}
        </>}
    </div>
  );
}
