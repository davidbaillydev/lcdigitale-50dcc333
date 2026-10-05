import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/$slug/confidentialite")({
  head: legalHead("confidentialite"),
  component: () => <LegalPage doc="confidentialite" />,
});
