import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/$slug/cookies")({
  head: legalHead("cookies"),
  component: () => <LegalPage doc="cookies" />,
});
