import { createFileRoute } from "@tanstack/react-router";

/** Manifeste PWA par écran : la borne, la cuisine et le livreur s'ouvrent directement sur leur interface. */
const SLUG = /^[a-z0-9-]{1,60}$/;

function screenFor(start: string): { path: string; name: string; short: string; orientation: string } | null {
  if (start === "/livreur") return { path: "/livreur", name: "LC Digitale — Livreur", short: "Livreur", orientation: "portrait" };
  let m = start.match(/^\/([a-z0-9-]+)\/borne$/);
  if (m && SLUG.test(m[1]!)) return { path: start, name: `Borne — ${m[1]}`, short: "Borne", orientation: "any" };
  m = start.match(/^\/espace\/([a-z0-9-]+)$/);
  if (m && SLUG.test(m[1]!)) return { path: start, name: `Cuisine — ${m[1]}`, short: "Cuisine", orientation: "any" };
  return null;
}

export const Route = createFileRoute("/api/public/manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const s = screenFor(new URL(request.url).searchParams.get("start") ?? "");
        const base = {
          lang: "fr",
          display: "fullscreen",
          display_override: ["fullscreen", "standalone"],
          background_color: "#141210",
          theme_color: "#007af5",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };
        const body = s
          ? { ...base, id: s.path, name: s.name, short_name: s.short, start_url: s.path, scope: s.path, orientation: s.orientation }
          : { ...base, id: "/", name: "LC Digitale — Commande en ligne", short_name: "LC Digitale", start_url: "/", scope: "/", display: "standalone", display_override: undefined };
        return new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
