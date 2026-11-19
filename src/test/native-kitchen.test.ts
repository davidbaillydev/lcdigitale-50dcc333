import { afterEach, describe, expect, it, vi } from "vitest";
import { localSubnet, nativeKitchen } from "@/lib/native-kitchen";
import { sendToPrinter } from "@/lib/printer";

afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; vi.restoreAllMocks(); });

describe("application cuisine Android", () => {
  it("absente dans un navigateur ordinaire", () => { expect(nativeKitchen()).toBeNull(); });
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
