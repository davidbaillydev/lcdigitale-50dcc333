import { useEffect, useState } from "react";
import type { Restaurant } from "@/lib/shop";
import { BrandLogo } from "@/lib/brand";

/** Vidéo seulement si l'appareil n'a pas demandé moins d'animations ni d'économie de données. */
function useVideoAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setOk(!reduce && !saveData);
  }, []);
  return ok;
}

export function RestaurantBanner({ restaurant, preview, videoPreview, className = "" }: { restaurant: Restaurant; preview?: string | null | undefined; videoPreview?: string | null | undefined; className?: string }) {
  const src = preview !== undefined ? preview : restaurant.brand.bannerPath ? `/api/public/restaurant-banner/${restaurant.id}?v=${encodeURIComponent(restaurant.brand.bannerPath)}` : null;
  const videoSrc = videoPreview !== undefined ? videoPreview : restaurant.brand.bannerVideoPath ? `/api/public/restaurant-banner/${restaurant.id}?kind=video&v=${encodeURIComponent(restaurant.brand.bannerVideoPath)}` : null;
  const [failed, setFailed] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState<string | null>(null);
  const videoAllowed = useVideoAllowed();
  const showVideo = !!videoSrc && videoFailed !== videoSrc && (videoAllowed || videoPreview !== undefined);
  return (
    <div aria-label={`Bannière de ${restaurant.name}`} className={`absolute inset-0 overflow-hidden bg-primary ${className}`}>
      {src && failed !== src ? <img src={src} alt={`Bannière de ${restaurant.name}`} className="h-full w-full object-cover" onError={() => setFailed(src)} /> : !showVideo && (
        <div data-banner-fallback className="flex h-full items-center justify-end border-b-8 border-accent px-8 sm:px-16">
          <BrandLogo src={restaurant.logo_url} name={restaurant.name} className="h-32 w-32 object-contain sm:h-56 sm:w-56" />
        </div>
      )}
      {showVideo && (
        <video key={videoSrc} src={videoSrc} poster={src ?? undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover" onError={() => setVideoFailed(videoSrc)} />
      )}
    </div>
  );
}
