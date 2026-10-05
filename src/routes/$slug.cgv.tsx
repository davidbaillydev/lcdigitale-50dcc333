import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/$slug/cgv")({
  head: legalHead("cgv"),
  component: () => <LegalPage doc="cgv" />,
});
