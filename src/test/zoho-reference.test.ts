import { describe, it, expect } from "vitest";
import { zohoReference, lastDayOfMonth, INVOICE_ITEM_NAME, invoiceItemDescription, invoiceNotes, ACQUITTEMENT_NOTE } from "@/lib/agency-gains";

describe("Factures Zoho mensuelles", () => {
  it("référence stable par restaurant et par mois (anti-doublon)", () => {
    expect(zohoReference("2026-10", "ab12cd34-0000-1111")).toBe("COM-202610-AB12CD34");
    expect(zohoReference("2026-11", "ab12cd34-0000-1111")).not.toBe(zohoReference("2026-10", "ab12cd34-0000-1111"));
  });
  it("datée du dernier jour du mois", () => {
    expect(lastDayOfMonth("2026-10")).toBe("2026-10-31");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });
  it("ligne intitulée « Frais de service & utilisation plateforme digitale »", () => {
    expect(INVOICE_ITEM_NAME).toBe("Frais de service & utilisation plateforme digitale");
    expect(invoiceItemDescription("2026-10", "Wok & Sushi", 12)).toBe(
      "Frais de service sur 12 commandes en ligne réglées – octobre 2026 (Wok & Sushi)",
    );
  });
  it("remarques : mention d'acquittement, puis SIRET si renseigné", () => {
    expect(invoiceNotes("")).toBe(ACQUITTEMENT_NOTE);
    expect(invoiceNotes("").trim()).toBe("Facture pour information comptable – Montant déjà retenu sur les encaissements en ligne de la période (aucun règlement à effectuer de votre part).");
    expect(invoiceNotes("123 456 789 00012")).toBe(`${ACQUITTEMENT_NOTE}\nSIRET client : 123 456 789 00012`);
    expect(invoiceNotes("999").split("\n")).toHaveLength(2);
  });
});

