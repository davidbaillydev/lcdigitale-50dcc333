import { describe, expect, it } from "vitest";
import { kioskIdentity, normalizeKioskId, readerForKiosk } from "@/lib/kiosk-readers";

const config = { kioskReaders: [{ id: "1", label: "Entrée", reader: "tmr_A" }, { id: "2", label: "Terrasse", reader: "tmr_B" }] };

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
