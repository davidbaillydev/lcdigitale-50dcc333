import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne adresse de suivi : redirige vers le restaurant pilote
export const Route = createFileRoute("/suivi/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug/suivi/$id", params: { slug: "woknsushi", id: params.id }, statusCode: 301 });
  },
});
