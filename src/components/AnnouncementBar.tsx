import { Megaphone } from "lucide-react";
import { announcementText } from "@/lib/promo";
import type { Restaurant } from "@/lib/shop";
import { cn } from "@/lib/utils";

export function AnnouncementBar({ restaurant, className }: { restaurant: Restaurant; className?: string }) {
  const text = announcementText(restaurant.config);
  if (!text) return null;
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground", className)}>
      <Megaphone className="h-4 w-4 shrink-0" /> <span>{text}</span>
    </div>
  );
}
