import { distanceKm, type LatLng } from "./geo";

export type KitchenDeliveryOrder = {
  address?: string | null; postal_code?: string | null; city?: string | null;
  delivery_lat?: number | null; delivery_lng?: number | null; zone_name?: string | null;
};

function validPoint(point: unknown): point is LatLng {
  return Array.isArray(point) && point.length === 2 &&
    typeof point[0] === "number" && Number.isFinite(point[0]) && Math.abs(point[0]) <= 90 &&
    typeof point[1] === "number" && Number.isFinite(point[1]) && Math.abs(point[1]) <= 180;
}

export function kitchenDeliveryInfo(order: KitchenDeliveryOrder, origin?: LatLng | null) {
  const locality = [order.postal_code?.trim(), order.city?.trim()].filter(Boolean).join(" ");
  const address = [order.address?.trim(), locality].filter(Boolean).join(", ");
  const destination = [order.delivery_lat, order.delivery_lng];
  const km = validPoint(origin) && validPoint(destination) ? distanceKm(origin, destination) : null;
  return { address, km, zone: order.zone_name?.trim() || null };
}

/** Distance lisible sur tous les supports : une décimale, virgule française, « km ». */
export function formatDeliveryKm(km: number) {
  return `${km.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}