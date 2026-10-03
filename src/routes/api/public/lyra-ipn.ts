import { createFileRoute } from "@tanstack/react-router";

// Notification serveur à serveur de Lyra / PayZen (vads_url_check).
// La signature HMAC du restaurant est vérifiée avant toute écriture.
export const Route = createFileRoute("/api/public/lyra-ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        if (!form) return new Response("bad request", { status: 400 });
        const fields: Record<string, string> = {};
        for (const [k, v] of form.entries()) if (typeof v === "string" && (k.startsWith("vads_") || k === "signature")) fields[k] = v.slice(0, 500);
        if (!/^[0-9a-f-]{36}$/i.test(fields["vads_order_id"] ?? "")) return new Response("ignored");
        const { handleLyraResult } = await import("@/lib/payments.functions");
        try {
          const r = await handleLyraResult(fields);
          return new Response(`ok ${r}`);
        } catch {
          return new Response("invalid signature", { status: 401 });
        }
      },
    },
  },
});
