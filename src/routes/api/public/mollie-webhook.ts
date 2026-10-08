import { createFileRoute } from "@tanstack/react-router";

// Webhook Mollie : ne reçoit qu'un identifiant de paiement. On n'en fait jamais confiance :
// le statut réel est relu auprès de l'API Mollie avec la clé du restaurant avant toute écriture.
export const Route = createFileRoute("/api/public/mollie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const id = String(form?.get("id") ?? "");
        if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return new Response("ignored");
        const { handleMolliePayment } = await import("@/lib/payments.functions");
        try {
          const r = await handleMolliePayment(id);
          return new Response(`ok ${r}`);
        } catch (e) {
          console.error("mollie-webhook", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
