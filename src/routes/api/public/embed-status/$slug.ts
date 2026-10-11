import { createFileRoute } from "@tanstack/react-router";

/**
 * Lu par embed.js sur les sites clients : indique si le module « Bouton pour site web »
 * est activé pour ce restaurant. Aucune donnée privée (un booléen uniquement).
 */
export const Route = createFileRoute("/api/public/embed-status/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug ?? "";
        if (!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(slug)) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("restaurants").select("enabled_features").eq("slug", slug).maybeSingle();
        const ef = (data?.enabled_features ?? null) as Record<string, unknown> | null;
        // Clé absente = module actif (comportement par défaut)
        const enabled = !!data && ef?.["embed"] !== false;
        return Response.json({ enabled }, {
          headers: {
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
