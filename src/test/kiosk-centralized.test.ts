import { describe, expect, it } from "vitest";
import { kioskDetailsSchema, removeKioskSchema } from "@/lib/kiosk-licenses";
import { kioskAccess } from "@/lib/kiosk-readers";
import { kioskDemoData, kioskRestaurantRows } from "@/lib/kiosk-dashboard";
const draft = { restaurantId: "fc23060e-4518-46f9-b604-8bf2a0f9fabf", previousKioskId: "1", kioskId: "entree", label: "Entrée", status: "active", startsOn: "2026-11-20", notes: "" };
describe("gestion centralisée des bornes", () => {
  it("accepte lecteur vide ou omis pour une borne comptoir/QR", () => {
    expect(kioskDetailsSchema.parse(draft).reader).toBe("");
    expect(kioskDetailsSchema.parse({ ...draft, reader: "" }).reader).toBe("");
    expect(kioskDetailsSchema.parse({ ...draft, reader: " tmr_123 " }).reader).toBe("tmr_123");
  });
  it("refuse un identifiant ou un lecteur mal formé", () => {
    expect(kioskDetailsSchema.safeParse({ ...draft, kioskId: "BAD ID" }).success).toBe(false);
    expect(kioskDetailsSchema.safeParse({ ...draft, reader: "bad reader" }).success).toBe(false);
  });
  it("exige l’identifiant exact pour supprimer uniquement la borne choisie", () => {
    expect(removeKioskSchema.safeParse({ restaurantId: draft.restaurantId, kioskId: "2", confirmation: "1" }).success).toBe(false);
    expect(removeKioskSchema.parse({ restaurantId: draft.restaurantId, kioskId: "2", confirmation: "2" }).kioskId).toBe("2");
  });
  it("archive sans réafficher la borne ni perdre la facture", () => {
    const data = kioskDemoData("2026-11-20");
    const license = data.licenses.find((l) => l.restaurant_id === "demo-0" && l.kiosk_id === "2");
    if (!license) throw new Error("Licence absente");
    license.status = "ended"; license.archived_at = "2026-11-20T22:00:00Z";
    const r = data.restaurants.find((r) => r.id === "demo-0");
    if (!r) throw new Error("Restaurant absent");
    r.config = { kioskReaders: [{ id: "1", reader: "", active: true }, { id: "3", reader: "", active: true }] };
    expect(kioskRestaurantRows(data)[0]?.kiosks.map((k) => k.id)).toEqual(["1", "3"]);
    expect(kioskRestaurantRows(data)[0]?.unpaid).toBe(0);
    expect(data.billing.find((b) => b.license_id === license.id)?.status).toBe("invoiced");
    expect(kioskAccess(r.config, "2")).toBe("unknown");
    expect(kioskAccess(r.config, "1")).toBe("ok");
  });
  it("supprimer la dernière borne ne rétablit pas l’accès historique", () => {
    expect(kioskAccess({ kioskReaders: [] }, "1")).toBe("unknown");
    expect(kioskAccess({ kioskReaders: [] }, null)).toBe("unknown");
    expect(kioskAccess({}, null)).toBe("ok");
  });
});