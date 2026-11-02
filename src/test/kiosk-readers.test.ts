import { describe, expect, it } from "vitest";
import { normalizeKioskId, readerForKiosk } from "@/lib/kiosk-readers";

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
