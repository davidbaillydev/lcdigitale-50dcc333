import { describe, expect, it } from "vitest";
import { banFeatureToAddress, banSearchUrl, matchCpZone } from "@/lib/address-autocomplete";

describe("autocomplétion d'adresse (Base Adresse Nationale)", () => {
  it("construit l'adresse avec numéro et rue, code postal, ville et coordonnées", () => {
    const a = banFeatureToAddress({
      properties: { label: "12 rue des Lilas 31770 Colomiers", housenumber: "12", street: "rue des Lilas", postcode: "31770", city: "Colomiers" },
      geometry: { coordinates: [1.31, 43.61] },
    });
    expect(a).toEqual({ address: "12 rue des Lilas", postcode: "31770", city: "Colomiers", lat: 43.61, lng: 1.31, label: "12 rue des Lilas 31770 Colomiers" });
  });
  it("retombe sur la première ligne du libellé quand la rue seule est absente", () => {
    const a = banFeatureToAddress({ properties: { label: "Place du Marché 31770 Colomiers", postcode: "31770", city: "Colomiers" }, geometry: { coordinates: [1.3, 43.6] } });
    expect(a.address).toBe("Place du Marché");
    expect(a.postcode).toBe("31770");
  });
  it("encode la recherche et limite à 5 suggestions en mode autocomplétion", () => {
    expect(banSearchUrl("12 rue des Lilas")).toBe("https://api-adresse.data.gouv.fr/search/?q=12%20rue%20des%20Lilas&limit=5&autocomplete=1");
  });
  it("retrouve la zone de livraison par code postal, null hors zone", () => {
    const zones = [{ cp: "31770", city: "Colomiers" }, { cp: "31000", city: "Toulouse" }];
    expect(matchCpZone(zones, "31000")?.city).toBe("Toulouse");
    expect(matchCpZone(zones, "31500")).toBeNull();
  });
});
