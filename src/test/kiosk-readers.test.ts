import { describe, expect, it } from "vitest";
import {
  kioskIdentity,
  kioskReadersOf,
  normalizeKioskId,
  normalizeKioskReader,
  readerForKiosk,
} from "@/lib/kiosk-readers";
import { kioskChoices } from "@/lib/kiosk-switch";
import { kioskReadersInput } from "@/lib/payments/terminal";

const config = { kioskReaders: [{ id: "1", label: "Entrée", reader: "tmr_A" }, { id: "2", label: "Terrasse", reader: "tmr_B" }] };
const RID = "3f2b6c1a-9d4e-4a7b-8c5d-1e2f3a4b5c6d";

describe("un TPE par borne", () => {
  it("chaque borne déclenche son propre lecteur", () => {
    expect(readerForKiosk(config, "1")).toBe("tmr_A");
    expect(readerForKiosk(config, "2")).toBe("tmr_B");
  });
  it("sans identifiant ou borne inconnue : lecteur par défaut (fonctionnement actuel)", () => {
    expect(readerForKiosk(config, null)).toBeNull();
    expect(readerForKiosk(config, "9")).toBeNull();
    expect(readerForKiosk({}, "1")).toBeNull();
  });
  it("nettoie l'identifiant saisi dans l'adresse", () => {
    expect(normalizeKioskId(" Borne-2 ")).toBe("borne-2");
    expect(normalizeKioskId("<x>")).toBe("x");
    expect(normalizeKioskId("")).toBeNull();
  });
});

describe("borne sans TPE (comptoir ou QR code)", () => {
  const mixed = {
    kioskReaders: [
      { id: "1", label: "Entrée", reader: "tmr_A" },
      { id: "2", label: "Terrasse" },
      { id: "3", label: "Caisse", reader: "   " },
    ],
  };
  it("les bornes sans lecteur restent déclarées et visibles", () => {
    expect(kioskReadersOf(mixed).map((k) => k.id)).toEqual(["1", "2", "3"]);
    expect(kioskReadersOf(mixed).map((k) => k.reader)).toEqual(["tmr_A", "", ""]);
  });
  it("une borne sans lecteur ne déclenche aucun TPE propre", () => {
    expect(readerForKiosk(mixed, "2")).toBeNull();
    expect(readerForKiosk(mixed, "3")).toBeNull();
    expect(readerForKiosk(mixed, "1")).toBe("tmr_A");
  });
  it("la borne sans TPE s'affiche et se choisit normalement", () => {
    expect(kioskIdentity({ kioskReaders: [{ id: "5", label: "Comptoir" }] }, "5")?.text).toBe("Comptoir · Borne 5");
    expect(kioskChoices({ kioskReaders: [{ id: "5", label: "Comptoir" }, { id: "6", label: "Borne 6" }] })).toEqual([
      { id: "5", label: "Comptoir" },
      { id: "6", label: "" },
    ]);
  });
  it("nettoie l'identifiant de lecteur saisi", () => {
    expect(normalizeKioskReader("  tmr_A  ")).toBe("tmr_A");
    expect(normalizeKioskReader(undefined)).toBe("");
    expect(normalizeKioskReader(null)).toBe("");
    expect(normalizeKioskReader("x".repeat(100))).toHaveLength(80);
  });
});

describe("enregistrement des bornes", () => {
  it("accepte le lecteur vide ou omis", () => {
    const parsed = kioskReadersInput.parse({
      restaurantId: RID,
      kiosks: [
        { id: "1", label: "Entrée", reader: "" },
        { id: "2", label: "Terrasse" },
        { id: "3", label: "Caisse", reader: null },
      ],
    });
    expect(parsed.kiosks.map((k) => k.reader)).toEqual(["", "", ""]);
    expect(parsed.kiosks.map((k) => k.id)).toEqual(["1", "2", "3"]);
  });
  it("accepte un lecteur valide et la liste vide", () => {
    expect(kioskReadersInput.parse({ restaurantId: RID, kiosks: [{ id: "1", label: "Entrée", reader: "tmr_A" }] }).kiosks.map((k) => k.reader)).toEqual(["tmr_A"]);
    expect(kioskReadersInput.parse({ restaurantId: RID, kiosks: [] }).kiosks).toEqual([]);
  });
  it("refuse un lecteur mal formé ou trop long", () => {
    expect(() => kioskReadersInput.parse({ restaurantId: RID, kiosks: [{ id: "1", label: "E", reader: "tmr bad!" }] })).toThrow();
    expect(() => kioskReadersInput.parse({ restaurantId: RID, kiosks: [{ id: "1", label: "E", reader: "x".repeat(81) }] })).toThrow();
  });
  it("refuse un restaurant inconnu", () => {
    expect(() => kioskReadersInput.parse({ restaurantId: "pas-un-identifiant", kiosks: [{ id: "1", label: "E", reader: "" }] })).toThrow();
  });
});

describe("identification affichée de la borne", () => {
  it("affiche le numéro et le libellé de la borne active", () => {
    expect(kioskIdentity(config, "2")?.text).toBe("Terrasse · Borne 2");
  });
  it("sans libellé ou avec un libellé répété : le numéro seul", () => {
    expect(kioskIdentity({ kioskReaders: [{ id: "3", label: "", reader: "tmr_C" }] }, "3")?.text).toBe("Borne 3");
    expect(kioskIdentity({ kioskReaders: [{ id: "1", label: "borne 1", reader: "tmr_A" }] }, "1")?.text).toBe("Borne 1");
  });
  it("borne non déclarée mais identifiée : numéro quand même affiché", () => {
    expect(kioskIdentity(config, "7")?.text).toBe("Borne 7");
    expect(kioskIdentity({}, "4")?.text).toBe("Borne 4");
  });
  it("aucune borne identifiée : rien à afficher", () => {
    expect(kioskIdentity(config, null)).toBeNull();
    expect(kioskIdentity(config, "<*>")).toBeNull();
  });
});

import { kioskAccess } from "@/lib/kiosk-readers";
describe("activation des bornes", () => {
  const cfg = { kioskReaders: [{ id: "1", label: "A", reader: "" }, { id: "2", label: "B", reader: "", active: false }] };
  it("borne active par défaut", () => expect(kioskAccess(cfg, "1")).toBe("ok"));
  it("borne désactivée refusée", () => expect(kioskAccess(cfg, "2")).toBe("disabled"));
  it("borne non déclarée refusée", () => { expect(kioskAccess(cfg, "9")).toBe("unknown"); expect(kioskAccess(cfg, null)).toBe("unknown"); });
  it("aucune borne déclarée : fonctionnement historique", () => expect(kioskAccess({}, null)).toBe("ok"));
});
