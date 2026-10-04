import { Link } from "@tanstack/react-router";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/lib/cart";
import { BrandLogo } from "@/lib/brand";
import { ThemeToggle } from "@/lib/theme";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Phone } from "lucide-react";

export function SiteHeader({ hideCart }: { hideCart?: boolean }) {
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
          <ThemeToggle />
          {!hideCart && <CartSheet />}
        </div>
      </div>
    </header>
  );
}
