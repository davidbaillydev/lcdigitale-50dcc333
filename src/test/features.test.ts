import { describe, expect, it } from "vitest";
import { FEATURES, OPT_IN_FEATURES, featuresOf } from "@/lib/features";

describe("modules d'abonnement", () => {
  it("propose la caisse comptoir (POS) à l'agence", () => {
    const pos = FEATURES.find(([k]) => k === "pos");
    expect(pos?.[1]).toBe("Caisse comptoir (POS)");
    expect(pos?.[2]).toBe("Écran d'encaissement tactile, espèces, CB, titres restaurant et clôture Z.");
  });

  it("désactive la caisse par défaut (opt-in strict)", () => {
    expect(featuresOf(null).pos).toBe(false);
    expect(featuresOf({}).pos).toBe(false);
    expect(featuresOf({ borne: true }).pos).toBe(false);
    expect(featuresOf({ pos: false }).pos).toBe(false);
    expect(featuresOf({ pos: true }).pos).toBe(true);
  });

  it("laisse les autres modules actifs par défaut", () => {
    const f = featuresOf(null);
    for (const [k] of FEATURES) {
      if ((OPT_IN_FEATURES as readonly string[]).includes(k)) continue;
      expect(f[k], k).toBe(true);
    }
    expect(featuresOf({ borne: false }).borne).toBe(false);
    expect(featuresOf({ livraison: false }).livraison).toBe(false);
  });

  it("ne liste en opt-in strict que des modules existants", () => {
    for (const k of OPT_IN_FEATURES) expect(FEATURES.some(([x]) => x === k), k).toBe(true);
  });
});
