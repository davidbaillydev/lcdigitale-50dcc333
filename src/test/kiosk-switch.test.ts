import { beforeEach, describe, expect, it } from "vitest";
import { applyKioskId, kioskChoices } from "@/lib/kiosk-switch";

const config = {
  kioskReaders: [
    { id: "1", label: "Entrée", reader: "tmr_1" },
    { id: "2", label: "Borne 2", reader: "tmr_2" },
    { id: "2", label: "Doublon" },
    { id: "3", label: "" },
  ],
};

describe("bornes proposées au choix sur l'appareil", () => {
  it("liste les bornes déclarées, même sans TPE propre, sans doublon", () => {
    expect(kioskChoices(config)).toEqual([
      { id: "1", label: "Entrée" },
      { id: "2", label: "" },
      { id: "3", label: "" },
    ]);
  });
  it("renvoie une liste vide sans bornes déclarées", () => {
    expect(kioskChoices({})).toEqual([]);
    expect(kioskChoices(null)).toEqual([]);
  });
});

describe("choix de borne mémorisé sur l'appareil", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/woknsushi/borne");
    localStorage.clear();
  });

  it("écrit le numéro dans le stockage local et dans l'adresse", () => {
    expect(applyKioskId("woknsushi", " 2 ")).toBe("2");
    expect(localStorage.getItem("kiosk-id:woknsushi")).toBe("2");
    expect(new URL(window.location.href).searchParams.get("borne")).toBe("2");
  });

  it("retirer le numéro nettoie stockage et adresse", () => {
    applyKioskId("woknsushi", "1");
    expect(applyKioskId("woknsushi", null)).toBeNull();
    expect(localStorage.getItem("kiosk-id:woknsushi")).toBeNull();
    expect(new URL(window.location.href).searchParams.has("borne")).toBe(false);
  });

  it("refuse un numéro invalide sans rien laisser derrière lui", () => {
    applyKioskId("woknsushi", "1");
    expect(applyKioskId("woknsushi", "??")).toBeNull();
    expect(localStorage.getItem("kiosk-id:woknsushi")).toBeNull();
    expect(new URL(window.location.href).searchParams.has("borne")).toBe(false);
  });
});
