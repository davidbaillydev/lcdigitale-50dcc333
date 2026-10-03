import { Link } from "@tanstack/react-router";
import { CartSheet } from "@/components/CartSheet";
import { useCart } from "@/lib/cart";

export function SiteHeader({ hideCart }: { hideCart?: boolean }) {
  const { restaurant } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
        <Link to="/$slug" params={{ slug: restaurant.slug }} className="truncate font-display text-3xl">
          {restaurant.name}
        </Link>
        {!hideCart && <CartSheet />}
      </div>
    </header>
  );
}
