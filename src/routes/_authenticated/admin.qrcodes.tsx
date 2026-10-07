import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { Crumbs } from "@/components/Crumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/lib/theme";
import { useStaff } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/admin/qrcodes")({
  head: () => ({
    meta: [
      { title: "Générateur de QR codes — Console agence" },
      { name: "description", content: "QR codes imprimables par restaurant : tables, room service, libre-service et consultation." },
      { property: "og:title", content: "Générateur de QR codes" },
      { property: "og:description", content: "QR codes avec logo, export PNG et PDF." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { restaurants, loading } = useStaff();
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between gap-3"><Crumbs page="QR codes" /><ThemeToggle /></div>
      <h1 className="mt-4 text-5xl">Générateur de QR codes</h1>
      <p className="text-sm text-muted-foreground">Choisissez un restaurant : QR par table (avec validation serveur en option), room service, libre-service et consultation seule, logo au centre, export PNG ou PDF.</p>
      {loading ? <Skeleton className="mt-6 h-40 w-full" /> : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {restaurants.map((r) => (
            <li key={r.slug}>
              <Link to="/espace/$slug/qr" params={{ slug: r.slug }} className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary">
                <QrCode className="h-6 w-6 text-primary" /><span className="font-semibold">{r.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
