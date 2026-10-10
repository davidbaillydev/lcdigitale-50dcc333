import { X } from "lucide-react";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/lib/cart";
import { BrandLogo } from "@/lib/brand";
import { postToParent } from "@/lib/embed";

/** Barre compacte affichée à la place du SiteHeader quand la carte est intégrée en iframe. */
export function EmbedBar({ hideCart }: { hideCart?: boolean }) {
  const { restaurant } = useCart();
  return (
    <header data-embed="1" className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2">
        <BrandLogo src={restaurant.logo_url} name={restaurant.name} />
        <span className="min-w-0 flex-1 truncate font-display text-xl">{restaurant.name}</span>
        {!hideCart && <CartSheet />}
        <button
          type="button"
          aria-label="Fermer la commande en ligne"
          onClick={() => postToParent({ type: "lc:close" })}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
