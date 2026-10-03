import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cuisine/")({
  beforeLoad: () => { throw redirect({ to: "/espace", statusCode: 301 }); },
});
