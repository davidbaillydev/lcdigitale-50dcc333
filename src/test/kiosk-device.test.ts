import { beforeEach, describe, expect, it } from "vitest";
import { clearKioskDevice, KIOSK_DEVICE_KEY, kioskDevicePath, parseKioskDevice, readKioskDevice, saveKioskDevice, setupKioskChoices } from "@/lib/kiosk-device";
import { applyKioskId } from "@/lib/kiosk-switch";

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/istanbul/borne"); });
describe("configuration locale LC Borne", () => {
  it("mémorise restaurant et identifiant, sans PIN ni autres données", () => {
    saveKioskDevice(localStorage, { slug: "istanbul", kioskId: "2" });
    expect(readKioskDevice(localStorage)).toEqual({ slug: "istanbul", kioskId: "2" });
    expect(JSON.parse(localStorage.getItem(KIOSK_DEVICE_KEY) ?? "null")).toEqual({ slug: "istanbul", kioskId: "2" });
    expect(localStorage.getItem("kiosk-id:istanbul")).toBe("2");
    expect(kioskDevicePath({ slug: "istanbul", kioskId: "2" })).toBe("/istanbul/borne?borne=2");
  });
  it("refuse les adresses et identifiants malformés", () => {
    for (const value of [null, {}, { slug: "https://evil.test", kioskId: "1" }, { slug: "istanbul", kioskId: "../1" }, { slug: "istanbul", kioskId: "" }]) expect(parseKioskDevice(value)).toBeNull();
    localStorage.setItem(KIOSK_DEVICE_KEY, "broken-json");
    expect(readKioskDevice(localStorage)).toBeNull();
  });
  it("ne propose que les bornes déclarées actives, sans TPE obligatoire", () => {
    expect(setupKioskChoices({ kioskReaders: [{ id: "1", label: "Entrée", reader: "" }, { id: "2", label: "Étage", active: false }, { id: "1", label: "Doublon" }, { id: "3", label: "Comptoir" }] })).toEqual([{ id: "1", label: "Entrée" }, { id: "3", label: "Comptoir" }]);
    expect(setupKioskChoices({})).toEqual([]);
  });
  it("réinitialise uniquement l’identité et conserve imprimante et file locale", () => {
    saveKioskDevice(localStorage, { slug: "istanbul", kioskId: "1" });
    localStorage.setItem("lc-kiosk-printer", "printer-settings");
    localStorage.setItem("lc-kiosk-print-queue:istanbul", "pending-jobs");
    clearKioskDevice(localStorage, "istanbul");
    expect(readKioskDevice(localStorage)).toBeNull();
    expect(localStorage.getItem("kiosk-id:istanbul")).toBeNull();
    expect(localStorage.getItem("lc-kiosk-printer")).toBe("printer-settings");
    expect(localStorage.getItem("lc-kiosk-print-queue:istanbul")).toBe("pending-jobs");
  });
  it("synchronise un changement PIN de numéro avec le prochain lancement", () => {
    saveKioskDevice(localStorage, { slug: "istanbul", kioskId: "1" });
    applyKioskId("istanbul", "3");
    expect(readKioskDevice(localStorage)?.kioskId).toBe("3");
    applyKioskId("istanbul", null);
    expect(readKioskDevice(localStorage)).toBeNull();
  });
});