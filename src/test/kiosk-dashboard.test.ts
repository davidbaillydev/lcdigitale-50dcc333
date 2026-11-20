import { describe, expect, it } from "vitest";
import { demoKioskActive, kioskDemoData, kioskPayment, kioskRestaurantRows, kioskUrl } from "@/lib/kiosk-dashboard";
import { kioskAccess, kioskReadersOf } from "@/lib/kiosk-readers";

describe("parc des bornes et licences", () => {
  it("fournit trois restaurants avec deux à quatre bornes et des impayés", () => {
    const rows = kioskRestaurantRows(kioskDemoData("2026-11-20"));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.kiosks.length)).toEqual([3, 2, 4]);
    expect(rows.map((r) => r.unpaid)).toEqual([1, 0, 1]);
  });
  it("la suspension d’une borne laisse les autres bornes et licences inchangées", () => {
    const original = kioskDemoData("2026-11-20");
    const next = demoKioskActive(original, "demo-0", "2", false);
    const restaurant = next.restaurants.find((r) => r.id === "demo-0");
    expect(kioskAccess(restaurant?.config, "2")).toBe("disabled");
    expect(kioskAccess(restaurant?.config, "1")).toBe("ok");
    expect(kioskReadersOf(original.restaurants[0]?.config).every((k) => k.active)).toBe(true);
    expect(next.restaurants[1]).toEqual(original.restaurants[1]);
    expect(next.licenses).toEqual(original.licenses);
    expect(next.billing).toEqual(original.billing);
    expect(kioskAccess(demoKioskActive(next, "demo-0", "2", true).restaurants[0]?.config, "2")).toBe("ok");
  });
  it("ne considère pas une ancienne facture payée comme règlement de la nouvelle période", () => {
    const data = kioskDemoData("2026-11-20");
    const license = data.licenses[0];
    if (!license) throw new Error("Licence manquante");
    expect(kioskPayment(data, license).status).toBe("paid");
    expect(kioskPayment(data, { ...license, starts_on: "2027-11-20", ends_on: "2028-11-20" }).status).toBe("to_invoice");
  });
  it("un impayé ne suspend jamais une borne automatiquement", () => {
    const unpaid = kioskRestaurantRows(kioskDemoData("2026-11-20")).flatMap((r) => r.kiosks).filter((k) => k.payment.status === "invoiced");
    expect(unpaid).toHaveLength(2);
    expect(unpaid.every((k) => k.active)).toBe(true);
    expect(unpaid.every((k) => k.reader === "")).toBe(true);
  });
  it("construit l'adresse dédiée de chaque borne avec son identifiant", () => {
    expect(kioskUrl("https://lcdigitale.lovable.app", "tacos-house", "1")).toBe("https://lcdigitale.lovable.app/tacos-house/borne?borne=1");
    expect(kioskUrl("https://commande.frenchpouletbraise.com/", "french-poulet-braise", "borne-2")).toBe("https://commande.frenchpouletbraise.com/french-poulet-braise/borne?borne=borne-2");
  });
  it("chaque restaurant du parc expose un slug pour le lien de ses bornes", () => {
    const data = kioskDemoData("2026-11-20");
    expect(data.restaurants.every((r) => typeof r.slug === "string" && r.slug.length > 0)).toBe(true);
  });
  it("la fiche présente le libellé enregistré dans la licence", () => {
    const data = kioskDemoData("2026-11-20");
    const first = data.licenses[0];
    if (!first) throw new Error("Licence manquante");
    first.label = "Nouvel emplacement";
    expect(kioskRestaurantRows(data)[0]?.kiosks[0]?.label).toBe("Nouvel emplacement");
  });
});