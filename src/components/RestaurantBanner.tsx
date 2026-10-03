import { useState } from "react";
import type { Restaurant } from "@/lib/shop";
import { BrandLogo } from "@/lib/brand";

export function RestaurantBanner({ restaurant, preview, className = "" }: { restaurant: Restaurant; preview?: string | null | undefined; className?: string }) {
  const src = preview !== undefined ? preview : restaurant.brand.bannerPath ? `/api/public/restaurant-banner/${restaurant.id}?v=${encodeURIComponent(restaurant.brand.bannerPath)}` : null;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div aria-label={`Bannière de ${restaurant.name}`} className={`absolute inset-0 overflow-hidden bg-primary ${className}`}>
      {src && failed !== src ? <img src={src} alt={`Bannière de ${restaurant.name}`} className="h-full w-full object-cover" onError={() => setFailed(src)} /> : (
        <div data-banner-fallback className="flex h-full items-center justify-end border-b-8 border-accent px-8 sm:px-16">
          <BrandLogo src={restaurant.logo_url} name={restaurant.name} className="h-32 w-32 object-contain sm:h-56 sm:w-56" />
        </div>
      )}
    </div>
  );
}