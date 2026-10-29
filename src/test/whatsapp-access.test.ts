import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone, whatsappUrl } from "@/lib/whatsapp-access";
import { computeServiceFee } from "@/lib/service-fee";

describe("accès WhatsApp", () => {
  it("normalise un numéro français local", () => {
    expect(normalizeWhatsAppPhone("06 12 34 56 78")).toBe("33612345678");
  });
  it("conserve un indicatif international explicite", () => {
    expect(normalizeWhatsAppPhone("+32 (470) 12 34 56")).toBe("32470123456");
    expect(normalizeWhatsAppPhone("0033 6 12 34 56 78")).toBe("33612345678");
  });
  it("ouvre un choix de destinataire quand aucun numéro n’est renseigné", () => {
    const url = new URL(whatsappUrl("", "Bonjour & merci\n🍳"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBe("Bonjour & merci\n🍳");
  });
  it("transmet le texte ajusté et le numéro ajusté sans paramètres parasites", () => {
    const url = new URL(whatsappUrl("07 12 34 56 78", "Texte modifié ? & # + https://example.com/livreur?r=resto"));
    expect(url.pathname).toBe("/33712345678");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.searchParams.get("text")).toBe("Texte modifié ? & # + https://example.com/livreur?r=resto");
  });
  it("n’applique pas les frais aux livraisons si le canal est désactivé", () => {
    expect(computeServiceFee({ enabled: true, value: 2, modes: { delivery: false, pickup: true, dine_in: true, kiosk: true } }, 20, "delivery")).toBe(0);
  });
  it("respecte le montant fixe et le pourcentage configurés", () => {
    expect(computeServiceFee({ enabled: true, kind: "fixed", value: 2 }, 20, "delivery")).toBe(2);
    expect(computeServiceFee({ enabled: true, kind: "percent", value: 5 }, 20, "delivery")).toBe(1);
    expect(computeServiceFee(undefined, 20, "delivery")).toBe(0);
  });
});