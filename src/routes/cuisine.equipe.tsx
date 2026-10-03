import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cuisine/equipe")({
  beforeLoad: () => {
    throw redirect({ to: "/cuisine/$slug/equipe", params: { slug: "woknsushi" } });
  },
});
