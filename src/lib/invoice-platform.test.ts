import { describe, expect, it } from "vitest";
import { invoicePlatformReadiness } from "./invoice-platform";
import type { Invoice } from "./invoice";

const invoice: Invoice = { number: "FAC-2026-00001", issued_at: "2026-10-07T10:00:00Z", data: { seller: { company: "Restaurant test", form: "", capital: "", siret: "12345678901234", rcs: "", vat: "", seat: "1 rue du Test", tradeName: "Test", address: "", city: "", phone: "", email: "" }, buyer: { name: "Test", email: "", address: "" }, orderNumber: 1, orderDate: "2026-10-07", lines: [], vatRate: 10, totalHT: 10, totalVAT: 1, totalTTC: 11, paid: false, paymentMethod: "on_site" } };
describe("Préparation plateforme agréée", () => {
  it("never marks an existing B2C invoice ready for B2B transmission", () => {
    const result = invoicePlatformReadiness(invoice);
    expect(result.ready).toBe(false);
    expect(result.status).toBe("not_connected");
    expect(result.missing).toContain("Identité et SIREN du client professionnel");
  });
  it("reports invalid seller identity and inconsistent totals", () => {
    const result = invoicePlatformReadiness({ ...invoice, data: { ...invoice.data, seller: { ...invoice.data.seller, siret: "", company: "" }, totalTTC: 12 } });
    expect(result.missing).toContain("SIRET du vendeur (14 chiffres)");
    expect(result.missing).toContain("Totaux HT / TVA / TTC cohérents");
  });
});