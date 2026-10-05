import { Link } from "@tanstack/react-router";
import { openCookieSettings } from "@/lib/consent";

export function LegalFooter({ slug }: { slug: string }) {
  const cls = "underline-offset-2 hover:underline";
  return (
    <nav aria-label="Informations légales" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
      <Link to="/$slug/mentions-legales" params={{ slug }} className={cls}>Mentions légales</Link>
      <Link to="/$slug/confidentialite" params={{ slug }} className={cls}>Confidentialité</Link>
      <Link to="/$slug/cgv" params={{ slug }} className={cls}>CGV</Link>
      <Link to="/$slug/cookies" params={{ slug }} className={cls}>Cookies</Link>
      <button type="button" onClick={openCookieSettings} className={cls}>Gérer les cookies</button>
    </nav>
  );
}
