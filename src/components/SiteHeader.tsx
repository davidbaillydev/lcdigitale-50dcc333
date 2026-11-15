import { Link } from "@tanstack/react-router";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/lib/cart";
import { BrandLogo } from "@/lib/brand";
import { ThemeToggle } from "@/lib/theme";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Phone } from "lucide-react";
import { LANG_LABELS, type Lang } from "@/lib/i18n";

export function SiteHeader({ hideCart, lang, onLang }: { hideCart?: boolean; lang?: Lang; onLang?: (l: Lang) => void }) {
  const { restaurant } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <AnnouncementBar restaurant={restaurant} />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
        <Link to="/$slug" params={{ slug: restaurant.slug }} className="flex min-w-0 items-center gap-3 font-display text-3xl">
          <BrandLogo src={restaurant.logo_url} name={restaurant.name} />
          <span className="truncate">{restaurant.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          {restaurant.vapi_phone_number && (
            <a href={`tel:${restaurant.vapi_phone_number.replace(/[^\d+]/g, "")}`} aria-label={`Commander par téléphone : ${restaurant.vapi_phone_number}`}
              className="flex items-center gap-2 rounded-full border border-primary px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">
              <Phone className="h-4 w-4" /><span className="hidden md:inline">Commander par tél :</span><span className="hidden sm:inline">{restaurant.vapi_phone_number}</span>
            </a>
          )}
          {lang && onLang && (
            <label className="relative">
              <span className="sr-only">Langue de la carte</span>
              <select value={lang} onChange={(e) => onLang(e.target.value as Lang)} aria-label="Langue de la carte"
                className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card px-3 text-xs font-bold hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
              </select>
            </label>
          )}
          <ThemeToggle />
          {!hideCart && <CartSheet />}
        </div>
      </div>
    </header>
  );
}
