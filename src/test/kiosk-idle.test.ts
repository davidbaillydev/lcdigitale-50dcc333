import { describe, expect, it } from "vitest";
import { kioskIdleAction } from "@/lib/kiosk-idle";

describe("borne : retour automatique à l'accueil", () => {
  it("revient à l'accueil après 60 s d'inactivité", () => {
    expect(kioskIdleAction("menu", 60_001)).toBe("reset");
    expect(kioskIdleAction("menu", 59_000)).toBe("warn");
    expect(kioskIdleAction("menu", 30_000)).toBe("none");
  });
  it("revient à l'accueil après une commande terminée", () => {
    expect(kioskIdleAction("done", 15_001)).toBe("reset");
    expect(kioskIdleAction("done", 10_000)).toBe("none");
  });
  it("n'interrompt jamais un paiement en cours", () => {
    expect(kioskIdleAction("terminal", 600_000)).toBe("none");
    expect(kioskIdleAction("qr", 600_000)).toBe("none");
  });
});
