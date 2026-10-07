import { describe, expect, it } from "vitest";
import { distanceKm, findZone, inPolygon, zoneFee, type GeoZone } from "./geo";

const center: [number, number] = [43.6112, 1.3353]; // Colomiers
const ring: GeoZone = { id: "r", name: "Rayon 3 km", type: "circle", center, radiusKm: 3, minOrder: 15, fee: 3, freeFrom: 40, tiers: [{ from: 25, fee: 1.5 }] };
const square: GeoZone = { id: "p", name: "Quartier", type: "polygon", points: [[43.6, 1.40], [43.6, 1.45], [43.65, 1.45], [43.65, 1.40]], minOrder: 20, fee: 5, freeFrom: 0 };

describe("zones de livraison", () => {
  it("calcule une distance réaliste", () => {
    expect(distanceKm(center, [43.6045, 1.444])).toBeGreaterThan(8); // Colomiers → Toulouse ~9 km
    expect(distanceKm(center, [43.6045, 1.444])).toBeLessThan(10);
  });
  it("éligibilité rayon : dedans / dehors", () => {
    expect(findZone([43.62, 1.34], [ring])?.id).toBe("r");
    expect(findZone([43.70, 1.34], [ring])).toBeNull();
  });
  it("éligibilité polygone", () => {
    expect(inPolygon([43.62, 1.42], square.points!)).toBe(true);
    expect(inPolygon([43.62, 1.39], square.points!)).toBe(false);
    expect(findZone([43.62, 1.42], [ring, square])?.id).toBe("p");
  });
  it("la première zone de la liste l'emporte en cas de chevauchement", () => {
    const big: GeoZone = { ...ring, id: "big", radiusKm: 20 };
    expect(findZone([43.62, 1.34], [big, ring])?.id).toBe("big");
  });
  it("frais : base, dégressif, offerts", () => {
    expect(zoneFee(ring, 18)).toBe(3);
    expect(zoneFee(ring, 30)).toBe(1.5);
    expect(zoneFee(ring, 45)).toBe(0);
    expect(zoneFee(square, 500)).toBe(5); // freeFrom 0 = jamais offerte
  });
});
