import { afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false), plugin: { print: vi.fn().mockResolvedValue(undefined) }, registerPlugin: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: native.isNativePlatform },
  registerPlugin: native.registerPlugin.mockReturnValue(native.plugin),
}));
import { isNativeKitchen, localSubnet, nativeKitchen } from "@/lib/native-kitchen";
import { getPrinter, savePrinter, sendToPrinter } from "@/lib/printer";

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  native.isNativePlatform.mockReturnValue(false);
  native.plugin.print.mockClear();
  vi.restoreAllMocks();
});

describe("application cuisine Android", () => {
  it("absente dans un navigateur ordinaire", () => { expect(nativeKitchen()).toBeNull(); expect(isNativeKitchen()).toBe(false); });
  it("enregistre le plugin natif sous son nom Android", () => {
    expect(native.registerPlugin).toHaveBeenCalledWith("LcKitchen");
  });
  it("détecte Capacitor sans ancien objet Plugins", () => {
    native.isNativePlatform.mockReturnValue(true);
    expect(nativeKitchen()).toBe(native.plugin);
    expect(isNativeKitchen()).toBe(true);
  });
  it("utilise aussi la détection injectée avec le proxy enregistré", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(nativeKitchen()).toBe(native.plugin);
    expect(isNativeKitchen()).toBe(true);
  });
  it("ignore les plugins injectés si la plateforme est web", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => false, Plugins: { LcKitchen: native.plugin } };
    expect(nativeKitchen()).toBeNull();
  });
  it("ne détecte pas de cuisine pendant le rendu sans window", () => {
    vi.stubGlobal("window", undefined);
    try { expect(nativeKitchen()).toBeNull(); } finally { vi.unstubAllGlobals(); }
  });
  it("imprime via le proxy Capacitor en TCP 9100 sans pont HTTP", async () => {
    native.isNativePlatform.mockReturnValue(true);
    const fetch = vi.spyOn(globalThis, "fetch");
    await sendToPrinter({ type: "network", name: "x", host: "192.168.1.50" }, new Uint8Array([27, 64]));
    expect(native.plugin.print).toHaveBeenCalledWith({ host: "192.168.1.50", port: 9100, data: "G0A=" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("conserve les erreurs natives sans envoyer au pont", async () => {
    native.isNativePlatform.mockReturnValue(true);
    native.plugin.print.mockRejectedValueOnce(new Error("Imprimante indisponible"));
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(sendToPrinter({ type: "network", name: "x", host: "192.168.1.50" }, new Uint8Array([27, 64]))).rejects.toThrow("Imprimante indisponible");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("partage le pont TCP avec LC Borne en gardant son imprimante séparée", async () => {
    native.isNativePlatform.mockReturnValue(true);
    localStorage.clear();
    const kiosk = { type: "network" as const, name: "Borne", host: "192.168.1.60" };
    savePrinter(kiosk, "kiosk");
    expect(getPrinter("kitchen")).toBeNull();
    expect(getPrinter("kiosk")).toEqual(kiosk);
    const fetch = vi.spyOn(globalThis, "fetch");
    await sendToPrinter(kiosk, new Uint8Array([27, 64]), true);
    expect(native.plugin.print).toHaveBeenCalledWith({ host: "192.168.1.60", port: 9100, data: "G0A=" });
    expect(fetch).not.toHaveBeenCalled();
    localStorage.clear();
  });
  it("n'accepte que les réseaux locaux pour la recherche d'imprimantes", () => {
    expect(localSubnet("192.168.1.50")).toBe("192.168.1");
    expect(localSubnet("10.0.0")).toBe("10.0.0");
    expect(localSubnet("172.20.3.9")).toBe("172.20.3");
    expect(localSubnet("8.8.8.8")).toBeNull();
    expect(localSubnet("172.40.1.1")).toBeNull();
  });
  it("imprime en réseau directement depuis l'appli, sans pont", async () => {
    const print = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: { LcKitchen: { print } } };
    const f = vi.spyOn(globalThis, "fetch");
    await sendToPrinter({ type: "network", name: "x", host: "192.168.1.50" }, new Uint8Array([27, 64]));
    expect(print).toHaveBeenCalledWith({ host: "192.168.1.50", port: 9100, data: "G0A=" });
    expect(f).not.toHaveBeenCalled();
  });
});
