import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cuisine/$")({
  beforeLoad: ({ params }) => {
    const rest = (params._splat ?? "").replace(/^equipe$/, "");
    throw redirect({ href: rest ? `/espace/${rest}` : "/espace", statusCode: 301 });
  },
});
