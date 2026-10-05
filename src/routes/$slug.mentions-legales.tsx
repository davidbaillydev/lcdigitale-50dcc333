import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/$slug/mentions-legales")({
  head: legalHead("mentions-legales"),
  component: () => <LegalPage doc="mentions-legales" />,
});
