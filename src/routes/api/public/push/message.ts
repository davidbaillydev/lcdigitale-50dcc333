import { createFileRoute } from "@tanstack/react-router";

/** Lu par le service worker à la réception d'un push : renvoie le dernier message de cet appareil. */
export const Route = createFileRoute("/api/public/push/message")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ep = new URL(request.url).searchParams.get("endpoint") ?? "";
        if (!ep.startsWith("https://") || ep.length > 1000) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("push_subscriptions").select("last_title, last_body, last_url").eq("endpoint", ep).maybeSingle();
        if (!data?.last_body) return new Response("Not found", { status: 404 });
        return Response.json({ title: data.last_title, body: data.last_body, url: data.last_url }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
