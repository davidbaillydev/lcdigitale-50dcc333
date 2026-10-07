// Zones de livraison géographiques (rayon ou polygone) — calculs purs, partagés client/serveur.
export type LatLng = [number, number];
export type FeeTier = { from: number; fee: number };
export type GeoZone = {
  id: string;
  name: string;
  type: "circle" | "polygon";
  center?: LatLng;
  radiusKm?: number;
  points?: LatLng[];
  minOrder: number;
  fee: number;
  /** Livraison offerte à partir de ce montant (0 = jamais) */
  freeFrom: number;
  /** Frais dégressifs : à partir de `from` €, frais = `fee` */
  tiers?: FeeTier[];
};

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray casting : le point est-il dans le polygone ? */
export function inPolygon(p: LatLng, poly: LatLng[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!, [yj, xj] = poly[j]!;
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inZone(p: LatLng, z: GeoZone) {
  if (z.type === "circle") return !!z.center && !!z.radiusKm && distanceKm(p, z.center) <= z.radiusKm;
  return (z.points?.length ?? 0) >= 3 && inPolygon(p, z.points!);
}

/** Première zone qui contient le point (l'ordre de la liste fait foi). */
export const findZone = (p: LatLng, zones: GeoZone[]) => zones.find((z) => inZone(p, z)) ?? null;

export function zoneFee(z: GeoZone, subtotal: number) {
  if (z.freeFrom > 0 && subtotal >= z.freeFrom) return 0;
  const tier = [...(z.tiers ?? [])].sort((a, b) => b.from - a.from).find((t) => subtotal >= t.from);
  return tier ? tier.fee : z.fee;
}
