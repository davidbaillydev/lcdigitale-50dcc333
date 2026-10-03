import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/cuisine")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/cuisine/$slug", params: { slug: params.slug } });
  },
});
