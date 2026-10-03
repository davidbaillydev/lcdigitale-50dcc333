import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agence")({
  beforeLoad: () => { throw redirect({ to: "/admin", statusCode: 301 }); },
});
