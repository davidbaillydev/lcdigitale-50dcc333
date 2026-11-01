import { createFileRoute } from "@tanstack/react-router";

declare const __APP_BUILD_ID__: string;

// Public, no data: returns only the id of the currently deployed build.
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ build: __APP_BUILD_ID__ }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
