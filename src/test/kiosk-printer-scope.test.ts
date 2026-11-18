import { describe, it, expect, beforeEach } from "vitest";
import { getPrinter, savePrinter } from "@/lib/printer";

describe("imprimante borne séparée de la cuisine", () => {
  beforeEach(() => localStorage.clear());
  it("enregistrer l'imprimante borne ne change pas celle de la cuisine", () => {
    savePrinter({ type: "network", name: "Cuisine", host: "10.0.0.2", port: 9100 });
    savePrinter({ type: "network", name: "Borne", host: "10.0.0.9", port: 9100 }, "kiosk");
    expect(getPrinter()?.name).toBe("Cuisine");
    expect(getPrinter("kiosk")?.name).toBe("Borne");
    savePrinter(null, "kiosk");
    expect(getPrinter("kiosk")).toBeNull();
    expect(getPrinter()?.name).toBe("Cuisine");
  });
});
