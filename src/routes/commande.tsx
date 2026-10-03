import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne adresse (avant le multi-restaurants) : redirige vers le restaurant pilote
export const Route = createFileRoute("/commande")({
  beforeLoad: () => {
    throw redirect({ to: "/$slug/commande", params: { slug: "woknsushi" }, statusCode: 301 });
  },
});
